import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { addSchema } from "@hyperjump/json-schema/draft-2020-12"
import { ethers } from "ethers"
import Hash from "ipfs-only-hash"
import PQueue from "p-queue"

import {
	ActionArgument,
	ActionContext,
	ActionPayload,
	ContractMetadata,
	Model,
	ModelValue,
	Query,
	ChainImplementation,
} from "@canvas-js/interfaces"

import * as constants from "../constants.js"
import type { Effect } from "../modelStore.js"
import { ApplicationError } from "../errors.js"
import { mapEntries, signalInvalidType, toHex } from "../utils.js"

import {
	loadModule,
	wrapObject,
	unwrapObject,
	disposeCachedHandles,
	call,
	wrapJSON,
	resolvePromise,
	wrapArray,
	recursiveWrapJSONObject,
	// newBigInt,
} from "./utils.js"
import { validateCanvasSpec } from "./validate.js"
import { CustomActionDefinition, Exports, disposeExports } from "./exports.js"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
}

interface VMConfig extends VMOptions {
	app: string
	spec: string
	chains: ChainImplementation[]
}

export class VM {
	public static async initialize(config: VMConfig): Promise<VM> {
		const { app, spec, chains = [new EthereumChainImplementation()], ...options } = config

		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		const moduleHandle = await loadModule(context, app, spec)

		const { exports, errors, warnings } = validateCanvasSpec(context, moduleHandle)

		if (exports === null) {
			// return errors
			throw Error(errors.join("\n"))
		} else {
			for (const warning of warnings) {
				console.log(chalk.yellow(`[canvas-vm] Warning: ${warning}`))
			}

			return new VM(app, runtime, context, chains, options, exports)
		}
	}

	public static async validate(spec: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		const cid = await Hash.of(spec)

		let moduleHandle: QuickJSHandle
		try {
			moduleHandle = await loadModule(context, `ipfs://${cid}`, spec)
		} catch (err) {
			if (err instanceof Error) {
				return { valid: false, errors: [err.toString()], warnings: [] }
			} else {
				throw err
			}
		}

		const { exports, errors, warnings } = validateCanvasSpec(context, moduleHandle)

		let result: { valid: boolean; errors: string[]; warnings: string[] }
		if (exports === null) {
			result = { valid: false, errors, warnings }
		} else {
			// dispose handles in the validation object
			disposeExports(exports)
			result = { valid: true, errors: [], warnings }
		}

		disposeCachedHandles(context)
		context.dispose()
		runtime.dispose()

		return result
	}

	public readonly appName: string
	public readonly models: Record<string, Model>
	public readonly actions: string[]
	public readonly customActionSchemaName: string | null
	public readonly customAction: CustomActionDefinition | null
	public readonly routes: Record<string, string[]>
	public readonly contracts: Record<string, ethers.Contract>
	public readonly contractMetadata: Record<string, ContractMetadata>
	public readonly sources: Set<string>

	private readonly routeHandles: Record<string, QuickJSHandle>
	private readonly actionHandles: Record<string, QuickJSHandle>
	private readonly sourceHandles: Record<string, Record<string, QuickJSHandle>>
	private readonly contractsHandle: QuickJSHandle
	private readonly dbHandle: QuickJSHandle

	private readonly queue = new PQueue({ concurrency: 1 })
	private effects: Effect[] | null = null
	private actionContext: ActionContext | null = null
	private customActionContext: { timestamp: number } | null = null

	constructor(
		public readonly app: string,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		chains: ChainImplementation[],
		options: VMOptions,
		exports: Exports
	) {
		this.models = exports.models
		this.contractMetadata = exports.contractMetadata
		this.routeHandles = exports.routeHandles
		this.actionHandles = exports.actionHandles
		this.customAction = exports.customAction
		this.sourceHandles = exports.sourceHandles

		this.appName = exports.name || "Canvas"

		// Generate public fields that are derived from the passed in arguments
		this.sources = new Set(Object.keys(this.sourceHandles))
		this.actions = Object.keys(this.actionHandles)

		this.contracts = {}

		// should this just be done inside validate?
		let schemaName: string | null = null
		// compile the custom action schema
		if (this.customAction) {
			schemaName = `customActionSchema:${this.app}:${this.customAction.name}`
			addSchema(this.customAction.schema, schemaName)
		}
		this.customActionSchemaName = schemaName

		// add this back for ethers@v6
		// const functionNames: Record<string, string[]> = {}

		if (options.unchecked) {
			if (options.verbose) {
				console.log(`[canvas-vm] Skipping contract setup`)
			}
		} else {
			for (const [name, { chain, chainId, address, abi }] of Object.entries(this.contractMetadata)) {
				const implementation = chains.find(
					(implementation) => implementation.chain === chain && implementation.chainId === chainId
				)

				assert(implementation !== undefined, `no chain implmentation for ${chain}:${chainId}`)
				assert(implementation instanceof EthereumChainImplementation)
				assert(implementation.provider !== undefined, `no ethers provider for ${chain}:${chainId}`)
				const contract = new ethers.Contract(address, abi, implementation.provider)

				// functionNames[name] = abi.map((abi) => contract.interface.getFunctionName(abi))
				this.contracts[name] = contract
			}
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
			mapEntries(this.contracts, (contractName, contract) => {
				const functionHandles: Record<string, QuickJSHandle> = {}

				for (const functionName of Object.keys(contract.functions)) {
					// for (const functionName of functionNames[contractName]) {
					functionHandles[functionName] = context.newFunction(
						`${contractName}.${functionName}`,
						(...argHandles: QuickJSHandle[]) => {
							assert(this.actionContext !== null, "internal error: this.actionContext is null")
							const { block } = this.actionContext
							assert(
								block !== undefined,
								"action called a contract function but did not include a blockhash or block identifier"
							)

							const args = this.unwrapContractFunctionArguments(argHandles)

							if (options.verbose) {
								const call = `${contractName}.${functionName}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`
								console.log(`[canvas-vm] contract: ${chalk.green(call)} at block (${block})`)
							}

							const deferred = context.newPromise()

							// const result = contract.getFunction(functionName).staticCallResult(...args)
							const result = contract.functions[functionName](...args)
							result
								.then((result: ContractFunctionResult[]) =>
									wrapArray(context, result.map(this.wrapContractFunctionResult)).consume(deferred.resolve)
								)
								.catch((err) => deferred.reject(context.newString(err.toString())))
								.finally(() => runtime.executePendingJobs())

							return deferred.handle
						}
					)
					// }
				}

				return wrapObject(context, functionHandles)
			})
		)

		// install globals
		wrapObject(context, {
			// console.log:
			console: wrapObject(context, {
				log: context.newFunction("log", (...args) => console.log("[canvas-vm]", ...args.map(context.dump))),
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
	public async close() {
		await this.queue.onIdle()
		this.dbHandle.dispose()
		this.contractsHandle.dispose()

		disposeExports({
			name: this.appName,
			actionHandles: this.actionHandles,
			contractMetadata: this.contractMetadata,
			customAction: this.customAction,
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

	private getActionHandle(app: string, call: string): QuickJSHandle {
		if (app === this.app) {
			const handle = this.actionHandles[call]
			assert(handle !== undefined, "invalid action call")
			return handle
		} else {
			const source = this.sourceHandles[app]
			assert(source !== undefined, `no source with URI ${app}`)
			assert(source[call] !== undefined, "invalid source call")
			return source[call]
		}
	}

	/**
	 * Given a call, get a list of effects to pass to `modelStore.applyEffects`, to be applied to the models.
	 * Used by `.applyAction()` and when replaying actions.
	 */
	public async execute(hash: string | Buffer, { call, callArgs, ...context }: ActionPayload): Promise<Effect[]> {
		const effects: Effect[] = []

		// after setting this.effects here, always make sure to reset it to null before
		// returning or throwing an error - or the core won't be able to process more actions
		this.effects = effects
		this.actionContext = context
		try {
			await this.queue.add(() => {
				assert(this.effects !== null && this.actionContext !== null)
				const actionHandle = this.getActionHandle(this.actionContext.app!, call)

				const argHandles = wrapObject(
					this.context,
					mapEntries(callArgs, (_, arg) => this.wrapActionArgument(arg))
				)

				return this.executeInternal(typeof hash === "string" ? hash : toHex(hash), actionHandle, argHandles)
			})
		} finally {
			this.effects = null
			this.actionContext = null
		}

		return effects
	}

	/**
	 * Given a call, get a list of effects to pass to `modelStore.applyEffects`, to be applied to the models.
	 * Used by `.applyAction()` and when replaying actions.
	 */
	public async executeCustomAction(
		hash: string | Buffer,
		payload: any,
		actionContext: { timestamp: number }
	): Promise<Effect[]> {
		const effects: Effect[] = []

		// after setting this.effects here, always make sure to reset it to null before
		// returning or throwing an error - or the core won't be able to process more actions
		this.effects = effects
		this.customActionContext = { timestamp: actionContext.timestamp }
		try {
			await this.queue.add(() => {
				assert(this.effects !== null && this.customActionContext !== null)
				assert(!!this.customAction)
				const payloadHandle = recursiveWrapJSONObject(this.context, payload)
				return this.executeInternal(typeof hash === "string" ? hash : toHex(hash), this.customAction.fn, payloadHandle)
			})
		} finally {
			this.effects = null
			this.customActionContext = null
		}

		return effects
	}

	/**
	 * Assumes this.effects and this.actionContext are already set
	 */
	private async executeInternal(hash: string, actionHandle: QuickJSHandle, argHandles: QuickJSHandle) {
		const ctx = wrapJSON(this.context, { hash, ...(this.actionContext || {}), ...(this.customActionContext || {}) })
		this.context.setProp(ctx, "db", this.dbHandle)
		this.context.setProp(ctx, "contracts", this.contractsHandle)

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

	private unwrapContractFunctionArguments = (argHandles: QuickJSHandle[]): ContractFunctionArgument[] => {
		const args = argHandles.map(this.context.dump)

		for (const arg of args) {
			switch (typeof arg) {
				case "string":
					continue
				case "boolean":
					continue
				case "number":
					continue
				case "bigint":
					continue
				default:
					throw new Error("invalid contract function argument")
			}
		}

		return args
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
		} else if (typeof value === "bigint") {
			// TODO: support real bigints
			// return newBigInt(this.context, value)
			return this.context.newNumber(Number(value))
		} else if (ethers.BigNumber.isBigNumber(value)) {
			return this.context.newNumber(value.toNumber())
		} else {
			console.error(value)
			throw new Error("Unsupported value type in contract function result")
		}
	}
}

export type ContractFunctionArgument = string | boolean | number | bigint
export type ContractFunctionResult = string | boolean | number | bigint | ethers.BigNumber
