import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { transform } from "sucrase"
import { ethers } from "ethers"

import {
	ActionArgument,
	ActionContext,
	ActionPayload,
	ContractMetadata,
	Model,
	ModelValue,
	Query,
	BlockProvider,
} from "@canvas-js/interfaces"

import type { Effect } from "../modelStore.js"
import { ApplicationError } from "../errors.js"
import { mapEntries, signalInvalidType } from "../utils.js"

import {
	loadModule,
	wrapObject,
	unwrapObject,
	disposeCachedHandles,
	call,
	wrapJSON,
	resolvePromise,
	wrapArray,
} from "./utils.js"

import * as constants from "../constants.js"
import { isLeft } from "fp-ts/lib/Either.js"
import { validateCanvasSpec } from "./validate.js"

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
}

interface VMConfig extends VMOptions {
	uri: string
	spec: string
	providers?: Record<string, BlockProvider>
}

export class VM {
	public static async initialize({ uri, spec, providers, ...options }: VMConfig): Promise<VM> {
		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		const { code: transpiledSpec } = transform(spec, {
			transforms: ["jsx"],
			jsxPragma: "React.createElement",
			jsxFragmentPragma: "React.Fragment",
			disableESTransforms: true,
			production: true,
		})

		const moduleHandle = await loadModule(context, uri, transpiledSpec)
		return new VM(uri, runtime, context, moduleHandle, providers ?? {}, options)
	}

	public static async validateWithoutCreating({
		uri,
		spec,
		providers,
		...options
	}: VMConfig): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		let transpiledSpec: string
		try {
			transpiledSpec = transform(spec, {
				transforms: ["jsx"],
				jsxPragma: "React.createElement",
				jsxFragmentPragma: "React.Fragment",
				disableESTransforms: true,
				production: true,
			}).code
		} catch (e: any) {
			return {
				valid: false,
				errors: [e.message],
				warnings: [],
			}
		}

		const moduleHandle = await loadModule(context, uri, transpiledSpec)
		const { validation, warnings } = validateCanvasSpec(context, moduleHandle, providers ?? {}, options)

		if (isLeft(validation)) {
			return {
				valid: false,
				// use flatMap to remove null values
				errors: validation.left.flatMap((err) => (err && err.message ? [err.message] : [])),
				warnings,
			}
		} else {
			return { valid: true, errors: [], warnings }
		}
	}

	public readonly models: Record<string, Model>
	public readonly actions: string[]
	public readonly routes: Record<string, string[]>
	public readonly contracts: Record<string, ethers.Contract>
	public readonly contractMetadata: Record<string, ContractMetadata>
	public readonly component: string | null = null
	public readonly sources: Set<string> = new Set([])

	public readonly routeHandles: Record<string, QuickJSHandle>

	private readonly actionHandles: Record<string, QuickJSHandle>
	private readonly sourceHandles: Record<string, Record<string, QuickJSHandle>>
	private readonly contractsHandle: QuickJSHandle
	private readonly dbHandle: QuickJSHandle

	private effects: Effect[] | null = null
	private actionContext: ActionContext | null = null

	constructor(
		public readonly uri: string,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		moduleHandle: QuickJSHandle,
		providers: Record<string, BlockProvider>,
		options: VMOptions
	) {
		const { validation } = validateCanvasSpec(context, moduleHandle, providers, options)

		if (isLeft(validation)) {
			throw Error(validation.left[0].message)
		} else {
			const validatedData = validation.right
			this.models = validatedData.models
			this.actions = validatedData.actions
			this.routes = validatedData.routes
			this.contracts = validatedData.contracts
			this.contractMetadata = validatedData.contractMetadata
			this.component = validatedData.component
			this.sources = validatedData.sources
			this.routeHandles = validatedData.routeHandles
			this.actionHandles = validatedData.actionHandles
			this.sourceHandles = validatedData.sourceHandles
		}

		this.dbHandle = wrapObject(
			context,
			mapEntries(this.models, (name, model) =>
				wrapObject(context, {
					set: context.newFunction("set", (idHandle, valuesHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined)
						assert(valuesHandle !== undefined)
						const id = idHandle.consume(context.getString)
						const values = this.unwrapModelValues(model, valuesHandle)
						this.effects.push({ type: "set", model: name, id, values })
					}),
					delete: context.newFunction("delete", (idHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined)
						const id = idHandle.consume(context.getString)
						this.effects.push({ type: "del", model: name, id })
					}),
				})
			)
		)

		this.contractsHandle = wrapObject(
			context,
			mapEntries(this.contracts, (name, contract) =>
				wrapObject(
					context,
					mapEntries(contract.functions, (key, fn) =>
						context.newFunction(`${name}.${key}`, (...argHandles: QuickJSHandle[]) => {
							assert(this.actionContext !== null, "internal error: this.actionContext is null")
							const { blockhash } = this.actionContext
							assert(blockhash !== undefined, "action called a contract function but did not include a blockhash")
							const args = argHandles.map(context.dump)
							if (options.verbose) {
								const call = chalk.green(`${name}.${key}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`)
								console.log(`[canvas-vm] contract: ${call} at block (${blockhash})`)
							}

							const deferred = context.newPromise()
							fn.apply(contract, args)
								.then((result: ContractFunctionResult[]) =>
									wrapArray(context, result.map(this.wrapContractFunctionResult)).consume(deferred.resolve)
								)
								.catch((err) => deferred.reject(context.newString(err.toString())))
								.finally(() => runtime.executePendingJobs())

							return deferred.handle
						})
					)
				)
			)
		)

		// install globals
		wrapObject(context, {
			// console.log:
			console: wrapObject(context, {
				log: context.newFunction("log", (...args: any[]) => console.log("[canvas-vm]", ...args.map(context.dump))),
			}),

			assert: context.newFunction("assert", (condition: QuickJSHandle, message?: QuickJSHandle) => {
				if (message === undefined) {
					assert(context.dump(condition))
				} else {
					assert(context.dump(condition), context.getString(message))
				}
			}),

			// fetch:
			fetch: context.newFunction("fetch", (urlHandle: QuickJSHandle) => {
				assert(context.typeof(urlHandle) === "string", "url must be a string")
				const url = context.getString(urlHandle)
				const deferred = context.newPromise()
				if (options.verbose) {
					console.log("[canvas-vm] fetch:", url)
				}

				fetch(url)
					.then((res) => res.text())
					.then((data) => {
						if (options.verbose) {
							console.log(`[canvas-vm] fetch OK: ${url} (${data.length} bytes)`)
						}

						context.newString(data).consume((val) => deferred.resolve(val))
					})
					.catch((err) => {
						console.error("[canvas-vm] fetch error:", err.message)
						deferred.reject(context.newString(err.message))
					})

				deferred.settled.then(context.runtime.executePendingJobs)
				return deferred.handle
			}),
		}).consume((globalsHandle) => call(context, "Object.assign", null, context.global, globalsHandle).dispose())
	}

	/**
	 * Cleans up this VM instance.
	 */
	public dispose() {
		this.dbHandle.dispose()
		this.contractsHandle.dispose()

		for (const handle of Object.values(this.actionHandles)) {
			handle.dispose()
		}

		for (const source of Object.values(this.sourceHandles)) {
			for (const handle of Object.values(source)) {
				handle.dispose()
			}
		}

		for (const handle of Object.values(this.routeHandles)) {
			handle.dispose()
		}

		disposeCachedHandles(this.context)
		this.context.dispose()
		this.runtime.dispose()
	}

	/**
	 * Given a call to a route, get the result of the route function. Used by `modelStore.getRoute()`.
	 */
	public async executeRoute(
		route: string,
		params: Record<string, string | number>,
		execute: (sql: string | Query) => Record<string, ModelValue>[]
	): Promise<Record<string, ModelValue>[]> {
		const routeHandle = this.routeHandles[route]
		assert(routeHandle !== undefined, "invalid route")

		const argHandles = wrapObject(
			this.context,
			mapEntries(params, (_, param) => this.wrapActionArgument(param))
		)

		const ctxHandle = wrapObject(this.context, {
			db: wrapObject(this.context, {
				queryRaw: this.context.newFunction("queryRaw", (sqlHandle: QuickJSHandle, argsHandle: QuickJSHandle) => {
					const objectHandle = this.context.newObject()
					const flag = this.context.newNumber(1)
					this.context.setProp(objectHandle, "query", sqlHandle)
					if (argsHandle !== undefined) {
						this.context.setProp(objectHandle, "args", argsHandle)
					}
					this.context.setProp(objectHandle, "___CANVAS_QUERY_INTERNAL", flag)
					flag.dispose()
					return objectHandle
				}),
			}),
		})

		assert(this.context.typeof(routeHandle) === "function", `${route} route is not a function`)
		const result = this.context.callFunction(routeHandle, this.context.undefined, argHandles, ctxHandle)
		ctxHandle.dispose()
		argHandles.dispose()

		if (isFail(result)) {
			const error = result.error.consume(this.context.dump)
			throw new ApplicationError(error)
		}

		const query = result.value.consume(this.context.dump)
		if (typeof query !== "string" && !(typeof query === "object" && query.___CANVAS_QUERY_INTERNAL === 1)) {
			throw new Error("route function must return a String or ctx.db.Query")
		}
		const results = execute(query)

		return results
	}

	private getActionHandle(spec: string, call: string): QuickJSHandle {
		if (spec === this.uri) {
			const handle = this.actionHandles[call]
			assert(handle !== undefined, "invalid action call")
			return handle
		} else {
			const source = this.sourceHandles[spec]
			assert(source !== undefined, `no source with URI ${spec}`)
			assert(source[call] !== undefined, "invalid source call")
			return source[call]
		}
	}

	/**
	 * Given a call, get a list of effects to pass to `modelStore.applyEffects`, to be applied to the models.
	 * Used by `.apply()` and when replaying actions.
	 */
	public async execute(hash: string, { call, args, ...context }: ActionPayload): Promise<Effect[]> {
		assert(this.effects === null && this.actionContext === null, "cannot apply more than one action at once")

		const actionHandle = this.getActionHandle(context.spec, call)

		const argHandles = wrapObject(
			this.context,
			mapEntries(args, (_, arg) => this.wrapActionArgument(arg))
		)

		const ctx = wrapJSON(this.context, {
			spec: context.spec,
			hash: hash,
			from: context.from,
			blockhash: context.blockhash,
			timestamp: context.timestamp,
		})

		this.context.setProp(ctx, "db", this.dbHandle)
		this.context.setProp(ctx, "contracts", this.contractsHandle)

		// after setting this.effects here, always make sure to reset it to null before
		// returning or throwing an error - or the core won't be able to process more actions
		this.effects = []
		this.actionContext = context
		const promiseResult = this.context.callFunction(actionHandle, this.context.undefined, argHandles, ctx)

		ctx.dispose()
		argHandles.dispose()

		if (isFail(promiseResult)) {
			const error = promiseResult.error.consume(this.context.dump)
			this.effects = null
			throw new ApplicationError(error)
		}

		const result = await promiseResult.value.consume((handle) => resolvePromise(this.context, handle))
		if (isFail(result)) {
			const error = result.error.consume(this.context.dump)
			this.effects = null
			throw new ApplicationError(error)
		}

		const returnValue = result.value.consume(this.context.dump)
		if (returnValue === false) {
			this.effects = null
			throw new Error("action rejected: not allowed")
		}

		if (returnValue !== undefined) {
			this.effects = null
			throw new Error("action rejected: unexpected return value")
		}

		const effects = this.effects
		this.effects = null
		this.actionContext = null
		return effects
	}

	public wrapActionArgument = (arg: ActionArgument): QuickJSHandle => {
		if (arg === null) {
			return this.context.null
		} else if (typeof arg === "boolean") {
			return arg ? this.context.true : this.context.false
		} else if (typeof arg === "number") {
			return this.context.newNumber(arg)
		} else if (typeof arg === "string") {
			return this.context.newString(arg)
		} else {
			signalInvalidType(arg)
		}
	}

	private unwrapModelValues = (model: Model, valuesHandle: QuickJSHandle): Record<string, ModelValue> => {
		const { id, updated_at, indexes, ...properties } = model
		const valueHandles = unwrapObject(this.context, valuesHandle)
		const values: Record<string, ModelValue> = {}

		for (const [property, type] of Object.entries(properties)) {
			assert(property in valueHandles)
			const valueHandle = valueHandles[property]
			if (type === "boolean") {
				values[property] = Boolean(valueHandle.consume(this.context.getNumber))
			} else if (type === "integer") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else if (type === "float") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else if (type === "string") {
				values[property] = valueHandle.consume(this.context.getString)
			} else if (type === "datetime") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else {
				signalInvalidType(type)
			}
		}

		return values
	}

	private wrapContractFunctionResult = (value: ContractFunctionResult): QuickJSHandle => {
		if (value === true) {
			return this.context.true
		} else if (value === false) {
			return this.context.false
		} else if (typeof value === "string") {
			return this.context.newString(value)
		} else if (typeof value === "number") {
			return this.context.newNumber(value)
		} else if (ethers.BigNumber.isBigNumber(value)) {
			// TODO: support real bigints
			// return newBigInt(this.context, value.toBigInt())
			return this.context.newNumber(value.toNumber())
		} else {
			console.error(value)
			throw new Error("Unsupported value type in contract function result")
		}
	}
}

type ContractFunctionResult = string | boolean | number | bigint
