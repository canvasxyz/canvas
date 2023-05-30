import chalk from "chalk"

import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { addSchema } from "@hyperjump/json-schema/draft-2020-12"
import Hash from "ipfs-only-hash"
import PQueue from "p-queue"

import { ethers } from "ethers"
import { verifyTypedData } from "ethers/lib/utils.js"

import {
	ActionArgument,
	ActionPayload,
	Model,
	ModelValue,
	Query,
	ChainImplementation,
	ContractMetadata,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { ApplicationError } from "@canvas-js/core/errors"
import { mapEntries, signalInvalidType, toHex, assert, getCustomActionSchemaName } from "@canvas-js/core/utils"
import * as constants from "@canvas-js/core/constants"
import type { Effect } from "@canvas-js/core/components/modelStore"

import {
	ContractFunctionArgument,
	ContractFunctionResult,
	loadModule,
	wrapObject,
	unwrapObject,
	disposeCachedHandles,
	call,
	wrapJSON,
	resolvePromise,
	wrapArray,
	recursiveWrapJSONObject,
} from "./utils.js"
import { validateCanvasSpec } from "./validate.js"
import { Exports, disposeExports } from "./exports.js"

type ActionContext = Omit<ActionPayload, "call" | "callArgs">

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
	noExpiration?: boolean
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

		try {
			if (errors.length > 0) {
				throw Error(errors.join("\n"))
			}

			// ensure we have chain implementations for the spec's caip-2s
			for (const signerCaip of exports.signers) {
				if (
					chains.find((impl) => {
						// Accept exact matches, or fuzzy matches where the contract requests "chain:*".
						// e.g.: if a spec has requested eip155:*, any ethereum chain implementation is sufficient.
						const signerCaipSubstring = signerCaip.slice(0, signerCaip.length - 1)
						return impl.chain === signerCaip || (signerCaip.endsWith("*") && impl.chain.startsWith(signerCaipSubstring))
					})
				) {
					continue
				} else {
					throw new Error(`${app} requires a chain implementation for ${signerCaip}`)
				}
			}

			// ensure we don't have extra chain implementations
			for (const impl of chains) {
				if (
					exports.signers.find((signerCaip) => {
						const signerCaipSubstring = signerCaip.slice(0, signerCaip.length - 1)
						return impl.chain === signerCaip || (signerCaip.endsWith("*") && impl.chain.startsWith(signerCaipSubstring))
					})
				) {
					continue
				} else {
					throw new Error(`${app} contract didn't declare a signer for ${impl.chain}`)
				}
			}

			for (const warning of warnings) {
				console.log(chalk.yellow(`[canvas-vm] Warning: ${warning}`))
			}

			return new VM(app, runtime, context, exports, chains, options)
		} catch (err) {
			disposeExports(exports)
			disposeCachedHandles(context)
			context.dispose()
			runtime.dispose()
			throw err
		}
	}

	public static async validate(spec: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
		const quickJS = await getQuickJS()
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(constants.RUNTIME_MEMORY_LIMIT)

		const cid = await Hash.of(spec)

		let moduleHandle: QuickJSHandle | undefined = undefined
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
		disposeExports(exports)
		disposeCachedHandles(context)
		context.dispose()
		runtime.dispose()
		return { valid: errors.length === 0, errors, warnings }
	}

	public readonly customActionSchemaName: string | null
	public readonly sources: Set<string>

	private readonly routeParameters: Record<string, string[]>
	private readonly contracts: Record<string, ethers.Contract>
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
		private readonly exports: Exports,
		private readonly chains: ChainImplementation[],
		private readonly options: VMOptions
	) {
		// Generate public fields that are derived from the passed in arguments
		this.sources = new Set(Object.keys(this.exports.sourceHandles))

		this.contracts = {}

		// compile the custom action schema
		this.customActionSchemaName = null
		if (this.exports.customAction !== null) {
			const { name, schema } = this.exports.customAction
			this.customActionSchemaName = getCustomActionSchemaName(this.app, name)
			addSchema(schema, this.customActionSchemaName)
		}

		// add this back for ethers@v6
		// const functionNames: Record<string, string[]> = {}

		if (this.options.unchecked) {
			if (this.options.verbose) {
				console.log(`[canvas-vm] Skipping contract setup`)
			}
		} else {
			for (const [name, { chain, address, abi }] of Object.entries(this.exports.contractMetadata)) {
				const implementation = this.chains.find((implementation) => implementation.chain === chain)

				assert(implementation !== undefined, `no chain implmentation for ${chain}`)
				assert(implementation instanceof EthereumChainImplementation, "only ethereum contracts are currently supported")
				assert(implementation.provider !== undefined, `no provider for ${chain}`)
				const contract = new ethers.Contract(address, abi, implementation.provider)

				// functionNames[name] = abi.map((abi) => contract.interface.getFunctionName(abi))
				this.contracts[name] = contract
			}
		}

		this.routeParameters = {}
		const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
		for (const name of Object.keys(this.exports.routeHandles)) {
			this.routeParameters[name] = []
			for (const [_, param] of name.matchAll(routeParameterPattern)) {
				this.routeParameters[name].push(param)
			}
		}

		this.dbHandle = wrapObject(
			context,
			mapEntries(this.exports.models, (name, model) =>
				wrapObject(context, {
					set: context.newFunction("set", (idHandle, valuesHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined, "set: missing id argument")
						assert(valuesHandle !== undefined, "set: missing values argument")
						const id = idHandle.consume(context.getString)
						const values = this.unwrapModelValues(name, model, valuesHandle)
						this.effects.push({ type: "set", model: name, id, values })
					}),
					delete: context.newFunction("delete", (idHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined, "delete: missing id argument")
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

							if (this.options.verbose) {
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
				if (this.options.verbose) {
					console.log("[canvas-vm] fetch:", url)
				}

				fetch(url)
					.then((res) => res.text())
					.then((data) => {
						if (this.options.verbose) {
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

			verifyTypedData: context.newFunction(
				"verifyTypedData",
				(domainHandle, typesHandle, valueHandle, signatureHandle) => {
					const domain = context.dump(domainHandle)
					const types = context.dump(typesHandle)
					const value = context.dump(valueHandle)
					const signature = context.dump(signatureHandle)
					return context.newString(verifyTypedData(domain, types, value, signature))
				}
			),
		}).consume((globalsHandle) => call(context, "Object.assign", null, context.global, globalsHandle).dispose())
	}

	/**
	 * Cleans up this VM instance.
	 */
	public async close() {
		await this.queue.onIdle()
		this.dbHandle.dispose()
		this.contractsHandle.dispose()

		disposeExports(this.exports)
		disposeCachedHandles(this.context)
		this.context.dispose()
		this.runtime.dispose()
	}

	public hasSigner(signerCaip: string): boolean {
		const matchingSigner = this.exports.signers.find(
			(signer) =>
				signerCaip === signer || (signer.endsWith("*") && signerCaip.startsWith(signer.slice(0, signer.length - 1)))
		)
		return matchingSigner !== undefined
	}

	public getSigners(): string[] {
		return this.exports.signers
	}

	public getModels(): Record<string, Model> {
		return this.exports.models
	}

	public getRoutes(): string[] {
		return Object.keys(this.exports.routeHandles)
	}

	public getRouteParameters(route: string): string[] {
		const parameters = this.routeParameters[route]
		if (parameters === undefined) {
			throw new Error("Route not found")
		} else {
			return parameters
		}
	}

	public getActions(): string[] {
		return Object.keys(this.exports.actionHandles)
	}

	public getContracts(): Record<string, ContractMetadata> {
		return this.exports.contractMetadata
	}

	/**
	 * Given a call to a route, get the result of the route function. Used by `modelStore.getRoute()`.
	 */
	public async executeRoute(
		route: string,
		params: Record<string, string | number>,
		execute: (sql: string | Query) => Record<string, ModelValue>[]
	): Promise<Record<string, ModelValue>[]> {
		const routeHandle = this.exports.routeHandles[route]
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
			const handle = this.exports.actionHandles[call]
			assert(handle !== undefined, "invalid action call")
			return handle
		} else {
			const source = this.exports.sourceHandles[app]
			assert(source !== undefined, `no source with URI ${app}`)
			assert(source[call] !== undefined, "invalid source call")
			return source[call]
		}
	}

	/**
	 * Given a call, get a list of effects to pass to `modelStore.applyEffects`, to be applied to the models.
	 * Also used when replaying actions.
	 */
	public async execute(hash: string | Uint8Array, { call, callArgs, ...context }: ActionPayload): Promise<Effect[]> {
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
	 * Also used when replaying actions.
	 */
	public async executeCustomAction(
		hash: Uint8Array,
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
				assert(this.exports.customAction !== null)
				const payloadHandle = recursiveWrapJSONObject(this.context, payload)
				return this.executeInternal(
					typeof hash === "string" ? hash : toHex(hash),
					this.exports.customAction.fn,
					payloadHandle
				)
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

	private unwrapModelValues = (name: string, model: Model, valuesHandle: QuickJSHandle): Record<string, ModelValue> => {
		const { id, updated_at, indexes, ...properties } = model
		const valueHandles = unwrapObject(this.context, valuesHandle)
		const values: Record<string, ModelValue> = {}

		for (const [property, type] of Object.entries(properties)) {
			assert(property in valueHandles, `missing property ${JSON.stringify(property)} in model ${name}`)
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
			return this.context.newBigInt(value)
		} else if (ethers.BigNumber.isBigNumber(value)) {
			return this.context.newBigInt(value.toBigInt())
		} else {
			console.error(value)
			throw new Error("Unsupported value type in contract function result")
		}
	}
}
