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
	unwrapArray,
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

type SpecValidationResult = {
	models: Record<string, Model>
	actions: string[]
	routes: Record<string, string[]>
	contracts: Record<string, ethers.Contract>
	contractMetadata: Record<string, ContractMetadata>
	component: string | null
	sources: Set<string>
	routeHandles: Record<string, QuickJSHandle>
	actionHandles: Record<string, QuickJSHandle>
	sourceHandles: Record<string, Record<string, QuickJSHandle>>
}

function validateCanvasSpec(
	context: QuickJSContext,
	moduleHandle: QuickJSHandle,
	providers: Record<string, BlockProvider>,
	options: VMOptions
): { validation: t.Validation<SpecValidationResult>; warnings: string[] } {
	const {
		models: modelsHandle,
		routes: routesHandle,
		actions: actionsHandle,
		contracts: contractsHandle,
		component: componentHandle,
		sources: sourcesHandle,
		...rest
	} = moduleHandle.consume((handle) => unwrapObject(context, handle))

	const warnings = []
	const errors: t.ValidationError[] = []

	/**
	 * This function is a replacement for `assert`, but instead of throwing an error
	 * it adds the `errors` list and returns the evaluated condition.
	 */
	const assertSaveError = (cond: boolean, message: string) => {
		if (!cond) {
			console.log(message)
			errors.push({
				value: null,
				context: [],
				message,
			})
		}
		return cond
	}

	for (const [name, handle] of Object.entries(rest)) {
		const extraneousExportWarning = `Warning: extraneous export ${JSON.stringify(name)}`
		console.log(chalk.yellow(`[canvas-vm] ${extraneousExportWarning}`))
		warnings.push(extraneousExportWarning)
		handle.dispose()
	}

	// validate models
	let models: Record<string, Model> = {}
	if (
		assertSaveError(modelsHandle !== undefined, "Spec is missing `models` export") &&
		assertSaveError(context.typeof(modelsHandle) === "object", "`models` export must be an object")
	) {
		const modelsValidation = modelsType.decode(modelsHandle.consume(context.dump))
		if (isLeft(modelsValidation)) {
			for (const error of modelsValidation.left) {
				errors.push(error)
			}
		} else {
			models = modelsValidation.right
			// validate models
			const modelNamePattern = /^[a-z][a-z_]*$/
			const modelPropertyNamePattern = /^[a-z][a-z_]*$/
			for (const [name, model] of Object.entries(models)) {
				assertSaveError(modelNamePattern.test(name), "invalid model name")
				const { indexes, ...properties } = model
				for (const property of Object.keys(properties)) {
					assertSaveError(modelPropertyNamePattern.test(property), `invalid model property name: ${property}`)
				}
				assertSaveError(
					properties.id === "string" && properties.updated_at === "datetime",
					`Models must include properties { id: "string" } and { updated_at: "datetime" }`
				)

				if (indexes !== undefined) {
					for (const index of indexes) {
						assertSaveError(index !== "id", `"id" index is redundant`)
						const indexProperties = Array.isArray(index) ? index : [index]
						for (const property of indexProperties) {
							assertSaveError(
								property in properties,
								`Index is invalid: "${property}" is not a field on model "${name}"`
							)
						}
					}
				}
			}
		}
	}

	// validate actions
	const actions: string[] = []
	let actionHandles: Record<string, QuickJSHandle> = {}

	if (
		assertSaveError(actionsHandle !== undefined, "Spec is missing `actions` export") &&
		assertSaveError(context.typeof(actionsHandle) === "object", "`actions` export must be an object")
	) {
		actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
		const actionNamePattern = /^[a-zA-Z]+$/
		for (const [name, handle] of Object.entries(actionHandles)) {
			if (
				assertSaveError(
					actionNamePattern.test(name),
					`Action ${name} is invalid: action names must match ${actionNamePattern}`
				) &&
				assertSaveError(
					context.typeof(handle) === "function",
					`Action ${name} is invalid: actions.${name} is not a function`
				)
			) {
				actions.push(name)
			}
		}
	}

	const routes: Record<string, string[]> = {}
	let routeHandles: Record<string, QuickJSHandle> = {}
	if (routesHandle !== undefined) {
		if (assertSaveError(context.typeof(routesHandle) === "object", "`routes` export must be an object")) {
			routeHandles = routesHandle.consume((handle) => unwrapObject(context, handle))
			const routeNamePattern = /^(\/:?[a-z_]+)+$/
			const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
			for (const [name, handle] of Object.entries(routeHandles)) {
				assertSaveError(
					routeNamePattern.test(name),
					`Route ${name} is invalid: the name must match the regex ${routeNamePattern}`
				)
				assertSaveError(context.typeof(handle) === "function", `Route ${name} is invalid: the route must be a function`)
				routes[name] = []
				for (const [_, param] of name.matchAll(routeParameterPattern)) {
					routes[name].push(param)
				}
			}
		}
	}

	// validate contracts
	const contracts: Record<string, ethers.Contract> = {}
	const contractMetadata: Record<string, ContractMetadata> = {}

	if (contractsHandle !== undefined) {
		if (assertSaveError(context.typeof(contractsHandle) === "object", "`contracts` export must be an object")) {
			// parse and validate contracts
			const contractHandles = contractsHandle.consume((handle) => unwrapObject(context, handle))
			const contractNamePattern = /^[a-zA-Z]+$/
			for (const [name, contractHandle] of Object.entries(contractHandles)) {
				assertSaveError(contractNamePattern.test(name), "invalid contract name")
				const contract = contractHandle.consume((handle) => unwrapObject(context, handle))
				const chain = contract.chain.consume(context.getString)
				const chainId = contract.chainId.consume(context.getString)
				const address = contract.address.consume(context.getString)
				const abi = contract.abi
					.consume((handle) => unwrapArray(context, handle))
					.map((item) => item.consume(context.getString))

				if (
					assertSaveError(chainType.is(chain), `invalid chain: ${chain}`) &&
					assertSaveError(chainIdType.is(chainId), `invalid chain id: ${chainId}`)
				) {
					contractMetadata[name] = { chain: chain as Chain, chainId, address, abi }

					if (options.unchecked) {
						if (options.verbose) {
							console.log(`[canvas-vm] Skipping contract setup`)
						}
					} else {
						if (chain == "eth") {
							const provider = providers[`${chain}:${chainId}`]
							if (provider instanceof EthereumBlockProvider) {
								contracts[name] = new ethers.Contract(address, abi, provider.provider)
							} else {
								errors.push({
									value: null,
									context: [],
									message: `Contract ${name} is invalid: spec requires an RPC endpoint for ${chain}:${chainId}`,
								})
							}
						}
					}
				}
			}
		}
	}

	let component: string | null = null
	if (componentHandle !== undefined) {
		if (assertSaveError(context.typeof(componentHandle) === "function", "`component` export must be a function")) {
			component = call(context, "Function.prototype.toString", componentHandle).consume(context.getString)
			componentHandle.dispose()
		}
	}

	const sourceHandles: Record<string, Record<string, QuickJSHandle>> = {}
	const sources: Set<string> = new Set([])
	if (sourcesHandle !== undefined) {
		if (assertSaveError(context.typeof(sourcesHandle) === "object", "`sources` export must be an object")) {
			for (const [source, sourceHandle] of Object.entries(
				sourcesHandle.consume((handle) => unwrapObject(context, handle))
			)) {
				assertSaveError(ipfsURIPattern.test(source), `Source "${source}" is invalid: the keys must be ipfs:// URIs`)
				assertSaveError(context.typeof(sourceHandle) === "object", `sources["${source}"] must be an object`)
				sourceHandles[source] = sourceHandle.consume((handle) => unwrapObject(context, handle))
				sources.add(source)
				for (const [name, handle] of Object.entries(sourceHandles[source])) {
					assertSaveError(
						context.typeof(handle) === "function",
						`Source "${source}" is invalid: sources["${source}"].${name} is not a function`
					)
				}
			}
		}
	}

	const validation =
		errors.length > 0
			? left(errors)
			: right({
					models,
					actions,
					routes,
					contracts,
					contractMetadata,
					component,
					sources,
					routeHandles,
					actionHandles,
					sourceHandles,
			  })

	return { validation, warnings }
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

		const { validation } = validateCanvasSpec(context, moduleHandle, providers ?? {}, options)

		if (isLeft(validation)) {
			const messages = validation.left.flatMap((err: t.ValidationError) => (err.message ? [err.message] : []))
			console.log(messages)
			throw Error("Invalid spec")
		} else {
			return new VM(uri, runtime, context, options, validation.right)
		}
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
				errors: [`Syntax error: ${e.message}`],
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
	public readonly routeHandles: Record<string, QuickJSHandle>
	private readonly actionHandles: Record<string, QuickJSHandle>
	private readonly sourceHandles: Record<string, Record<string, QuickJSHandle>>

	// public readonly models: Record<string, Model>
	public readonly component: string | null
	public readonly sources: Set<string>

	private readonly contractsHandle: QuickJSHandle
	private readonly dbHandle: QuickJSHandle

	private effects: Effect[] | null = null
	private actionContext: ActionContext | null = null

	constructor(
		public readonly uri: string,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		options: VMOptions,
		specValidationResult: SpecValidationResult
	) {
		this.models = specValidationResult.models
		this.actions = specValidationResult.actions
		this.routes = specValidationResult.routes
		this.contracts = specValidationResult.contracts
		this.contractMetadata = specValidationResult.contractMetadata
		this.routeHandles = specValidationResult.routeHandles
		this.actionHandles = specValidationResult.actionHandles
		this.sourceHandles = specValidationResult.sourceHandles
		this.component = specValidationResult.component
		this.sources = specValidationResult.sources

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
