import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { transform } from "sucrase"
import { ethers } from "ethers"
import * as t from "io-ts"
import { isLeft, left, right } from "fp-ts/lib/Either.js"

import {
	ActionArgument,
	ActionContext,
	ActionPayload,
	ContractMetadata,
	Model,
	ModelValue,
	Query,
	BlockProvider,
	Chain,
} from "@canvas-js/interfaces"
import { EthereumBlockProvider } from "@canvas-js/verifiers"

import * as constants from "../constants.js"
import type { Effect } from "../modelStore.js"
import { ApplicationError } from "../errors.js"
import { ipfsURIPattern, mapEntries, signalInvalidType } from "../utils.js"
import { chainType, chainIdType, modelsType } from "../codecs.js"

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

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
}

interface VMConfig extends VMOptions {
	uri: string
	spec: string
	providers?: Record<string, BlockProvider>
}

type Exports = {
	actionHandles: Record<string, QuickJSHandle>
	contractMetadata: Record<string, ContractMetadata>
	component: string | null
	models: Record<string, Model>
	routeHandles: Record<string, QuickJSHandle>
	sourceHandles: Record<string, Record<string, QuickJSHandle>>
}

function disposeExports(exports: Exports) {
	for (const handle of Object.values(exports.actionHandles)) {
		handle.dispose()
	}

	for (const handle of Object.values(exports.routeHandles)) {
		handle.dispose()
	}

	for (const sourceHandlesMap of Object.values(exports.sourceHandles)) {
		for (const handle of Object.values(sourceHandlesMap)) {
			handle.dispose()
		}
	}
}

function validateCanvasSpec(
	context: QuickJSContext,
	moduleHandle: QuickJSHandle
): { validation: t.Validation<Exports>; warnings: string[] } {
	const {
		models: modelsHandle,
		routes: routesHandle,
		actions: actionsHandle,
		contracts: contractsHandle,
		component: componentHandle,
		sources: sourcesHandle,
		...rest
	} = moduleHandle.consume((handle) => unwrapObject(context, handle))

	const warnings: string[] = []
	const errors: t.ValidationError[] = []

	/**
	 * This function is a replacement for `assert`, but instead of throwing an error
	 * it adds the `errors` list and returns the evaluated condition.
	 */
	const assertLogError = (cond: boolean, message: string) => {
		if (!cond) {
			errors.push({
				value: null,
				context: [],
				message,
			})
		}
		return cond
	}

	const exports = {
		models: {},
		contractMetadata: {},
		component: null,
		routeHandles: {},
		actionHandles: {},
		sourceHandles: {},
	} as Exports

	for (const [name, handle] of Object.entries(rest)) {
		const extraneousExportWarning = `Warning: extraneous export \`${name}\``
		console.log(chalk.yellow(`[canvas-vm] ${extraneousExportWarning}`))
		warnings.push(extraneousExportWarning)
		handle.dispose()
	}

	// validate models
	if (
		assertLogError(modelsHandle !== undefined, "Spec is missing `models` export") &&
		assertLogError(context.typeof(modelsHandle) === "object", "`models` export must be an object")
	) {
		const modelsValidation = modelsType.decode(modelsHandle.consume(context.dump))
		if (isLeft(modelsValidation)) {
			for (const error of modelsValidation.left) {
				errors.push(error)
			}
		} else {
			exports.models = modelsValidation.right
			// validate indexes
			for (const [name, model] of Object.entries(exports.models)) {
				const { indexes, ...properties } = model
				if (indexes !== undefined) {
					for (const index of indexes) {
						const indexProperties = Array.isArray(index) ? index : [index]
						for (const property of indexProperties) {
							assertLogError(
								property in properties,
								`Index is invalid: '${property}' is not a field on model '${name}'`
							)
						}
					}
				}
			}
		}
	}

	// validate actions
	if (assertLogError(actionsHandle !== undefined, "Spec is missing `actions` export")) {
		if (assertLogError(context.typeof(actionsHandle) === "object", "`actions` export must be an object")) {
			const actionNamePattern = /^[a-zA-Z]+$/
			for (const [name, handle] of Object.entries(actionsHandle.consume((handle) => unwrapObject(context, handle)))) {
				if (
					assertLogError(
						actionNamePattern.test(name),
						`Action '${name}' is invalid: action names must match ${actionNamePattern}`
					) &&
					assertLogError(
						context.typeof(handle) === "function",
						`Action '${name}' is invalid: 'actions.${name}' is not a function`
					)
				) {
					exports.actionHandles[name] = handle
				} else {
					handle.dispose()
				}
			}
		} else {
			actionsHandle.dispose()
		}
	}

	if (routesHandle !== undefined) {
		if (assertLogError(context.typeof(routesHandle) === "object", "`routes` export must be an object")) {
			exports.routeHandles = routesHandle.consume((handle) => unwrapObject(context, handle))
			const routeNamePattern = /^(\/:?[a-z_]+)+$/
			for (const [name, handle] of Object.entries(exports.routeHandles)) {
				assertLogError(
					routeNamePattern.test(name),
					`Route '${name}' is invalid: the name must match the regex ${routeNamePattern}`
				)
				assertLogError(
					context.typeof(handle) === "function",
					`Route '${name}' is invalid: the route must be a function`
				)
			}
		} else {
			routesHandle.dispose()
		}
	}

	// validate contracts
	if (contractsHandle !== undefined) {
		if (assertLogError(context.typeof(contractsHandle) === "object", "`contracts` export must be an object")) {
			// parse and validate contracts
			const contractHandles = contractsHandle.consume((handle) => unwrapObject(context, handle))
			const contractNamePattern = /^[a-zA-Z]+$/
			for (const [name, contractHandle] of Object.entries(contractHandles)) {
				assertLogError(contractNamePattern.test(name), "invalid contract name")
				const contract = contractHandle.consume(context.dump)
				const { chain, chainId, address, abi, ...rest } = contract

				if (
					assertLogError(
						chainType.is(chain),
						`Contract '${name}' is invalid: chain ${JSON.stringify(chain)} is invalid`
					) &&
					assertLogError(
						chainIdType.is(chainId),
						`Contract '${name}' is invalid: chain id ${JSON.stringify(chainId)} is invalid`
					)
				) {
					exports.contractMetadata[name] = { chain: chain as Chain, chainId, address, abi }
				}
			}
		} else {
			contractsHandle.dispose()
		}
	}

	if (componentHandle !== undefined) {
		if (assertLogError(context.typeof(componentHandle) === "function", "`component` export must be a function")) {
			exports.component = call(context, "Function.prototype.toString", componentHandle).consume(context.getString)
		}
		componentHandle.dispose()
	}

	if (sourcesHandle !== undefined) {
		if (assertLogError(context.typeof(sourcesHandle) === "object", "`sources` export must be an object")) {
			for (const [source, sourceHandle] of Object.entries(
				sourcesHandle.consume((handle) => unwrapObject(context, handle))
			)) {
				assertLogError(ipfsURIPattern.test(source), `Source '${source}' is invalid: the keys must be ipfs:// URIs`)
				assertLogError(context.typeof(sourceHandle) === "object", `sources["${source}"] must be an object`)
				exports.sourceHandles[source] = sourceHandle.consume((handle) => unwrapObject(context, handle))
				for (const [name, handle] of Object.entries(exports.sourceHandles[source])) {
					assertLogError(
						context.typeof(handle) === "function",
						`Source '${source}' is invalid: sources["${source}"].${name} is not a function`
					)
				}
			}
		} else {
			sourcesHandle.dispose()
		}
	}

	if (errors.length > 0) {
		disposeExports(exports)
		return {
			validation: left(errors),
			warnings,
		}
	} else {
		return {
			validation: right(exports),
			warnings,
		}
	}
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

		const { validation } = validateCanvasSpec(context, moduleHandle)

		if (isLeft(validation)) {
			// return errors
			const joinedMessage = validation.left.flatMap((err) => (err.message ? [err.message] : [])).join("\n")
			throw Error(joinedMessage)
		} else {
			return new VM(uri, runtime, context, options, validation.right, providers)
		}
	}

	public static async validateWithoutCreating({
		uri,
		spec,
		providers,
		...options
	}: VMConfig): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
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
				errors: [`Syntax error: ${e.message}`],
				warnings: [],
			}
		}

		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		const moduleHandle = await loadModule(context, uri, transpiledSpec)
		const { validation, warnings } = validateCanvasSpec(context, moduleHandle)

		let result: { valid: boolean; errors: string[]; warnings: string[] }
		if (isLeft(validation)) {
			result = {
				valid: false,
				// use flatMap to remove null values
				errors: validation.left.flatMap((err) => (err && err.message ? [err.message] : [])),
				warnings,
			}
		} else {
			// dispose handles in the validation object
			disposeExports(validation.right)

			result = { valid: true, errors: [], warnings }
		}

		disposeCachedHandles(context)
		context.dispose()
		runtime.dispose()

		return result
	}

	public readonly models: Record<string, Model>
	public readonly actions: string[]
	public readonly component: string | null
	public readonly routes: Record<string, string[]>
	public readonly contracts: Record<string, ethers.Contract>
	public readonly contractMetadata: Record<string, ContractMetadata>
	public readonly sources: Set<string>

	private readonly routeHandles: Record<string, QuickJSHandle>
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
		options: VMOptions,
		exports: Exports,
		providers: Record<string, BlockProvider> = {}
	) {
		this.models = exports.models
		this.contractMetadata = exports.contractMetadata
		this.routeHandles = exports.routeHandles
		this.actionHandles = exports.actionHandles
		this.sourceHandles = exports.sourceHandles
		this.component = exports.component

		// Generate public fields that are derived from the passed in arguments
		this.sources = new Set(Object.keys(this.sourceHandles))
		this.actions = Object.keys(this.actionHandles)

		this.contracts = {}

		if (options.unchecked) {
			if (options.verbose) {
				console.log(`[canvas-vm] Skipping contract setup`)
			}
		} else {
			Object.entries(this.contractMetadata).map(([name, { chain, chainId, address, abi }]) => {
				const provider = providers[`${chain}:${chainId}`]
				if (provider instanceof EthereumBlockProvider) {
					this.contracts[name] = new ethers.Contract(address, abi, provider.provider)
				} else {
					throw Error(`Cannot initialise VM, no provider exists for ${chain}:${chainId}`)
				}
			})
		}

		this.routes = {}
		const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
		for (const name of Object.keys(this.routeHandles)) {
			this.routes[name] = []
			for (const [_, param] of name.matchAll(routeParameterPattern)) {
				this.routes[name].push(param)
			}
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

		disposeExports({
			actionHandles: this.actionHandles,
			component: this.component,
			contractMetadata: this.contractMetadata,
			models: this.models,
			routeHandles: this.routeHandles,
			sourceHandles: this.sourceHandles,
		})

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
