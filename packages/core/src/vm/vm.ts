import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { transform } from "sucrase"
import { ethers } from "ethers"

import * as t from "io-ts"

import {
	ActionArgument,
	ActionContext,
	ActionPayload,
	ContractMetadata,
	Model,
	ModelValue,
} from "@canvas-js/interfaces"

import type { Effect } from "../modelStore.js"
import { chainIdType, chainType, modelsType } from "../codecs.js"
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
	unwrapArray,
	wrapArray,
} from "./utils.js"

import * as constants from "../constants.js"

type Options = { verbose?: boolean; unchecked?: boolean }

export class VM {
	public static async initialize(
		uri: string,
		spec: string,
		providers: Record<string, ethers.providers.JsonRpcProvider>,
		options: Options = {}
	): Promise<VM> {
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
		return new VM(runtime, context, moduleHandle, providers, options)
	}

	public readonly models: Record<string, Model>
	public readonly actions: string[]
	public readonly routes: Record<string, string[]>
	public readonly contracts: Record<string, ethers.Contract>
	public readonly contractMetadata: Record<string, ContractMetadata>
	public readonly component: string | null

	public readonly routeHandles: Record<string, QuickJSHandle>

	private readonly actionHandles: Record<string, QuickJSHandle>
	private readonly contractsHandle: QuickJSHandle
	private readonly dbHandle: QuickJSHandle

	private effects: Effect[] | null = null
	private actionContext: ActionContext | null = null

	constructor(
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		moduleHandle: QuickJSHandle,
		providers: Record<string, ethers.providers.JsonRpcProvider>,
		options: Options
	) {
		const {
			models: modelsHandle,
			routes: routesHandle,
			actions: actionsHandle,
			contracts: contractsHandle,
			component: componentHandle,
			...rest
		} = moduleHandle.consume((handle) => unwrapObject(context, handle))

		for (const [name, handle] of Object.entries(rest)) {
			console.log(chalk.yellow(`[canvas-vm] Warning: extraneous export ${JSON.stringify(name)}`))
			handle.dispose()
		}

		assert(modelsHandle !== undefined, "spec is missing `models` export")
		assert(actionsHandle !== undefined, "spec is missing `actions` export")
		assert(context.typeof(modelsHandle) === "object", "`models` export must be an object")
		assert(context.typeof(actionsHandle) === "object", "`actions` export must be an object")
		assert(
			contractsHandle === undefined || context.typeof(contractsHandle) === "object",
			"`contracts` export must be an object"
		)
		assert(
			componentHandle === undefined || context.typeof(componentHandle) === "function",
			"`component` export must be string"
		)

		this.models = validate(modelsType, modelsHandle.consume(context.dump), "invalid `models` export")

		// validate models
		const modelNamePattern = /^[a-z_]+$/
		const modelPropertyNamePattern = /^[a-z_]+$/
		for (const [name, model] of Object.entries(this.models)) {
			assertPattern(name, modelNamePattern, "invalid model name")
			assert(name.startsWith("_") === false, "model names cannot begin with an underscore")
			const { indexes, ...properties } = model
			for (const property of Object.keys(properties)) {
				assertPattern(property, modelPropertyNamePattern, `invalid model property name: ${property}`)
				assert(property.startsWith("_") === false, "model property names cannot begin with an underscore")
			}
			assert(
				properties.id === "string" && properties.updated_at === "datetime",
				`Models must include properties { id: "string" } and { updated_at: "datetime" }`
			)

			if (indexes !== undefined) {
				for (const index of indexes) {
					assert(index !== "id", `"id" index is redundant`)
					const indexProperties = Array.isArray(index) ? index : [index]
					for (const property of indexProperties) {
						assert(
							property in properties,
							`model specified an invalid index "${property}" - can only index on other model properties`
						)
					}
				}
			}
		}

		// parse and validate action handlers
		this.actions = []
		this.actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
		const actionNamePattern = /^[a-zA-Z]+$/
		for (const [name, handle] of Object.entries(this.actionHandles)) {
			assertPattern(name, actionNamePattern, "invalid action name")
			assert(context.typeof(handle) === "function", `actions.${name} is not a function`)
			this.actions.push(name)
		}

		this.routes = {}
		this.routeHandles = {}
		if (routesHandle !== undefined) {
			assert(context.typeof(routesHandle) === "object", "`routes` export must be an object")

			this.routeHandles = routesHandle.consume((handle) => unwrapObject(context, handle))
			const routeNamePattern = /^(\/:?[a-z_]+)+$/
			const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
			for (const [name, handle] of Object.entries(this.routeHandles)) {
				assertPattern(name, routeNamePattern, "invalid route name")
				assert(context.typeof(handle) === "function", `${name} route must be a function`)
				this.routes[name] = []
				for (const [_, param] of name.matchAll(routeParameterPattern)) {
					this.routes[name].push(param)
				}
			}
		}

		this.contracts = {}
		this.contractMetadata = {}
		if (contractsHandle !== undefined) {
			// parse and validate contracts
			const contractHandles = contractsHandle.consume((handle) => unwrapObject(context, handle))
			const contractNamePattern = /^[a-zA-Z]+$/
			for (const [name, contractHandle] of Object.entries(contractHandles)) {
				assertPattern(name, contractNamePattern, "invalid contract name")
				const contract = contractHandle.consume((handle) => unwrapObject(context, handle))
				const chain = contract.chain.consume(context.getString)
				const chainId = contract.chainId.consume(context.getNumber)
				const address = contract.address.consume(context.getString)
				const abi = contract.abi
					.consume((handle) => unwrapArray(context, handle))
					.map((item) => item.consume(context.getString))

				assert(chainType.is(chain), "invalid chain")
				assert(chainIdType.is(chainId), "invalid chain id")

				this.contractMetadata[name] = { chain, chainId, address, abi }

				if (options.unchecked) {
					if (options.verbose) {
						console.log(`[canvas-vm] Skipping contract setup`)
					}
				} else {
					const provider = providers[`${chain}:${chainId}`]
					assert(provider !== undefined, `Spec requires an RPC endpoint for ${chain}:${chainId}`)
					this.contracts[name] = new ethers.Contract(address, abi, provider)
				}
			}
		}

		if (componentHandle === undefined) {
			this.component = null
		} else {
			this.component = call(context, "Function.prototype.toString", componentHandle).consume(context.getString)
			componentHandle.dispose()
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

		disposeCachedHandles(this.context)
		this.context.dispose()
		this.runtime.dispose()
	}

	/**
	 * Executes a route function.
	 */
	public async run(
		route: string,
		params: Record<string, string>,
		execute: (sql: string) => Record<string, ModelValue>[]
	): Promise<Record<string, ModelValue>[]> {
		const routeHandle = this.routeHandles[route]
		assert(routeHandle !== undefined, "invalid route")

		// since route functions are just used to build queries, a
		// short-lived context is enough.
		//
		// TODO: check for shared state, and make sure this doesn't interfere with the context cache (in ./utils.js)
		const context = this.runtime.newContext()
		const argHandles = wrapObject(
			context,
			mapEntries(params, (_, param) => this.wrapActionArgument(param))
		)
		const result = context.callFunction(routeHandle, context.undefined, argHandles)
		argHandles.dispose()

		if (isFail(result)) {
			const error = result.error.consume(context.dump)
			throw new ApplicationError(error)
		}

		const query = result.value.consume(context.dump)
		if (typeof query !== "string") {
			throw new Error("route function returned invalid query")
		}
		const results = execute(query)

		return results
	}

	/**
	 * Given a call, get a list of effects to pass to `store.applyEffects`, to be applied to the models.
	 * Used by `.apply()` and when replaying actions.
	 */
	public async execute(hash: string, { call, args, ...context }: ActionPayload): Promise<Effect[]> {
		assert(this.effects === null && this.actionContext === null, "cannot apply more than one action at once")

		const actionHandle = this.actionHandles[call]
		assert(actionHandle !== undefined, "invalid action call")

		const argHandles = wrapObject(
			this.context,
			mapEntries(args, (_, arg) => this.wrapActionArgument(arg))
		)

		// everything that goes into the VM must be deterministic, and deterministic means normalized!
		const blockhash = context.blockhash ? context.blockhash.toLowerCase() : null
		const ctx = wrapJSON(this.context, {
			hash: hash.toLowerCase(),
			from: context.from.toLowerCase(),
			blockhash,
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

function validate<T>(type: t.Type<T>, value: any, message?: string): T {
	if (type.is(value)) {
		return value
	} else {
		throw new Error(message)
	}
}

function parseFunctionParameters(source: string): string[] {
	return source
		.replace(/[/][/].*$/gm, "") // strip single-line comments
		.replace(/\s+/g, "") // strip white space
		.replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
		.split("){", 1)[0]
		.replace(/^[^(]*[(]/, "") // extract the parameters
		.replace(/=[^,]+/g, "") // strip any ES6 defaults
		.split(",")
		.filter(Boolean) // split & filter [""]
}

const assertPattern = (value: string, pattern: RegExp, message: string) =>
	assert(pattern.test(value), `${message}: ${JSON.stringify(value)} does not match pattern ${pattern.source}`)
