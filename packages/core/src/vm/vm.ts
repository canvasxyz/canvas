import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { transform } from "sucrase"
import { ethers } from "ethers"

import * as t from "io-ts"
import * as E from "fp-ts/Either"
import * as R from "fp-ts/Record"

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

import type { Effect } from "../modelStore.js"
import { contractMetadatasType, modelsType } from "../codecs.js"
import { ApplicationError } from "../errors.js"
import { mapEntries, signalInvalidType, ipfsURIPattern } from "../utils.js"

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
	mergeValidationResults6,
} from "./utils.js"

import * as constants from "../constants.js"
import { isLeft, left, right } from "fp-ts/lib/Either.js"
import { pipe } from "fp-ts/lib/function.js"

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
}

interface VMConfig extends VMOptions {
	uri: string
	spec: string
	providers?: Record<string, BlockProvider>
}

function validateModels(
	context: QuickJSContext,
	modelsHandle?: QuickJSHandle
): t.Validation<{ models: Record<string, Model> }> {
	// if there is no models handle, then return
	if (modelsHandle == undefined) {
		return left([
			{
				value: null,
				context: [],
				message: "Spec is missing `models` export",
			},
		])
	}

	let models
	const modelsRawValue = modelsHandle.consume(context.dump)

	// validate models type
	const modelsTypeRes = modelsType.decode(modelsRawValue)

	// if there are any errors, then return
	if (isLeft(modelsTypeRes)) {
		return modelsTypeRes
	} else {
		models = modelsTypeRes.right
	}

	const errors: t.ValidationError[] = []

	// check indexes for errors
	for (const [name, model] of Object.entries(models)) {
		const { indexes, ...properties } = model
		if (indexes !== undefined) {
			for (const index of indexes) {
				// Can this check be done inside io-ts?
				if (index == "id") {
					errors.push({
						value: model,
						context: [],
						message: `"id" index is redundant`,
					})
				}
				const indexProperties = Array.isArray(index) ? index : [index]
				for (const property of indexProperties) {
					// TODO: check that index refers to an existing field on another model
					if (!(property in properties)) {
						errors.push({
							value: property,
							context: [],
							message: `Model ${name} specified an invalid index "${property}": can only index on other model properties`,
						})
					}
				}
			}
		}
	}

	if (errors) {
		return left(errors)
	} else {
		return right({ models })
	}
}

function validateActions(
	context: QuickJSContext,
	actionsHandle?: QuickJSHandle
): t.Validation<{ actions: string[]; actionHandles: Record<string, QuickJSHandle> }> {
	if (!actionsHandle) {
		return left([
			{
				value: null,
				context: [],
				message: "Spec is missing `actions` export",
			},
		])
	}

	if (context.typeof(actionsHandle) !== "object") {
		return left([
			{
				value: null,
				context: [],
				message: "`actions` export must be an object",
			},
		])
	}

	// parse and validate action handlers
	const errors: t.ValidationError[] = []

	const actions: string[] = []
	const actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
	const actionNamePattern = /^[a-zA-Z]+$/
	for (const [name, handle] of Object.entries(actionHandles)) {
		if (!actionNamePattern.test(name)) {
			errors.push({
				value: name,
				context: [],
				message: `${name} is invalid: action names must match ${actionNamePattern}`,
			})
		}

		if (context.typeof(handle) !== "function") {
			errors.push({
				value: name,
				context: [],
				message: `Action ${name} is invalid: actions.${name} is not a function`,
			})
		}

		actions.push(name)
	}

	if (errors) {
		return left(errors)
	} else {
		return right({ actions, actionHandles })
	}
}

function extractContractMetadata(context: QuickJSContext, contractHandle: QuickJSHandle): ContractMetadata {
	const contract = contractHandle.consume((handle) => unwrapObject(context, handle))
	const chain = contract.chain.consume(context.getString)
	const chainId = contract.chainId.consume(context.getNumber)
	const address = contract.address.consume(context.getString)
	const abi = contract.abi
		.consume((handle) => unwrapArray(context, handle))
		.map((item) => item.consume(context.getString))

	return { chain: chain as Chain, chainId, address, abi }
}

function validateContract(
	providers: Record<string, BlockProvider>,
	name: string,
	contractMetadata: ContractMetadata
): t.Validation<ethers.Contract | undefined> {
	const { chain, chainId, address, abi } = contractMetadata

	if (chain == "eth") {
		const provider = providers[`${chain}:${chainId}`]
		if (provider instanceof EthereumBlockProvider) {
			return right(new ethers.Contract(address, abi, provider.provider))
		}
	}

	return left([
		{
			value: `${chain}:${chainId}`,
			context: [],
			message: `Contract ${name} is invalid: spec requires an RPC endpoint for ${chain}:${chainId}`,
		},
	])
}

function validateContracts(
	context: QuickJSContext,
	providers: Record<string, BlockProvider>,
	options: VMOptions,
	contractsHandle?: QuickJSHandle
): t.Validation<{ contracts: Record<string, ethers.Contract>; contractMetadata: Record<string, ContractMetadata> }> {
	if (!contractsHandle) {
		return right({ contracts: {}, contractMetadata: {} })
	}

	if (context.typeof(contractsHandle) !== "object") {
		return left([
			{
				value: null,
				context: [],
				message: "`contracts` export must be an object",
			},
		])
	}

	// unwrap the contract metadata
	const contractMetadatas = pipe(
		contractsHandle.consume((handle) => unwrapObject(context, handle)),
		R.map((contractHandle: QuickJSHandle) => extractContractMetadata(context, contractHandle))
	)

	const contractMetadataValidation = contractMetadatasType.decode(contractMetadatas)

	if (isLeft(contractMetadataValidation)) {
		return contractMetadataValidation
	}

	let errors: t.ValidationError[] = []
	let contracts: Record<string, ethers.Contract> = {}

	if (options.unchecked) {
		if (options.verbose) {
			console.log(`[canvas-vm] Skipping contract setup`)
		}
	} else {
		for (const [name, contractMetadata] of Object.entries(contractMetadatas)) {
			const contractValidation = validateContract(providers, name, contractMetadata)
			if (isLeft(contractValidation)) {
				errors = errors.concat(contractValidation.left)
			} else {
				if (contractValidation.right) {
					contracts[name] = contractValidation.right
				}
			}
		}
	}

	if (errors) {
		return left(errors)
	} else {
		return right({ contracts, contractMetadata: contractMetadatas })
	}
}

function validateRoutes(
	context: QuickJSContext,
	routesHandle?: QuickJSHandle
): t.Validation<{ routes: Record<string, string[]>; routeHandles: Record<string, QuickJSHandle> }> {
	const routes: Record<string, string[]> = {}
	let routeHandles: Record<string, QuickJSHandle> = {}

	const errors: t.ValidationError[] = []

	if (routesHandle !== undefined) {
		if (context.typeof(routesHandle) != "object") {
			return left([
				{
					value: null,
					context: [],
					message: "`routes` export must be an object",
				},
			])
		}

		routeHandles = routesHandle.consume((handle) => unwrapObject(context, handle))

		const routeNamePattern = /^(\/:?[a-z_]+)+$/
		const routeParameterPattern = /:([a-zA-Z0-9_]+)/g

		for (const [name, handle] of Object.entries(routeHandles)) {
			if (!routeNamePattern.test(name)) {
				errors.push({
					value: name,
					context: [],
					message: `Route ${name} is invalid: the name must match the regex ${routeNamePattern}`,
				})
			}

			if (context.typeof(handle) !== "function") {
				errors.push({
					value: name,
					context: [],
					message: `Route ${name} is invalid: the route must be a function`,
				})
			}

			routes[name] = []
			for (const [_, param] of name.matchAll(routeParameterPattern)) {
				routes[name].push(param)
			}
		}
	}

	if (errors) {
		return left(errors)
	} else {
		return right({ routes, routeHandles })
	}
}

function validateComponents(
	context: QuickJSContext,
	componentHandle: QuickJSHandle
): t.Validation<{ component: string | null }> {
	let component: string | null = null

	if (componentHandle) {
		if (context.typeof(componentHandle) !== "function") {
			return left([
				{
					value: null,
					context: [],
					message: "`component` export must be a function",
				},
			])
		}

		component = call(context, "Function.prototype.toString", componentHandle).consume(context.getString)
		componentHandle.dispose()
	}
	return right({ component })
}

function validateSources(
	context: QuickJSContext,
	sourcesHandle: QuickJSHandle
): t.Validation<{ sources: Set<string>; sourceHandles: Record<string, Record<string, QuickJSHandle>> }> {
	if (sourcesHandle && context.typeof(sourcesHandle) !== "object") {
		return left([
			{
				value: null,
				context: [],
				message: "`sources` export must be an object",
			},
		])
	}

	const sourceHandles: Record<string, Record<string, QuickJSHandle>> = {}
	const sources = new Set<string>()
	const errors: t.ValidationError[] = []

	if (sourcesHandle !== undefined) {
		for (const [source, sourceHandle] of Object.entries(
			sourcesHandle.consume((handle) => unwrapObject(context, handle))
		)) {
			if (!ipfsURIPattern.test(source)) {
				errors.push({
					value: source,
					context: [],
					message: `Source ${source} is invalid: the keys must be ipfs:// URIs`,
				})
			}
			if (context.typeof(sourceHandle) !== "object") {
				errors.push({
					value: source,
					context: [],
					message: `Source ${source} is invalid: sources["${source}"] must be an object`,
				})
			}

			sourceHandles[source] = sourceHandle.consume((handle) => unwrapObject(context, handle))
			sources.add(source)
			for (const [name, handle] of Object.entries(sourceHandles[source])) {
				if (context.typeof(handle) !== "function")
					errors.push({
						value: source,
						context: [],
						message: `sources["${source}"].${name} is invalid: sources["${source}"].${name} is not a function`,
					})
			}
		}
	}
	if (errors) {
		return left(errors)
	} else {
		return right({ sources, sourceHandles })
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
		return new VM(uri, runtime, context, moduleHandle, providers ?? {}, options)
	}

	public static async validateWithoutCreating({ uri, spec, providers, ...options }: VMConfig): Promise<any> {
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
		return VM.validate(context, moduleHandle, providers ?? {}, options)
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

	public static validate(
		context: QuickJSContext,
		moduleHandle: QuickJSHandle,
		providers: Record<string, BlockProvider>,
		options: VMOptions
	): t.Validation<{
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
	}> {
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

		for (const [name, handle] of Object.entries(rest)) {
			const extraneousExportWarning = `[canvas-vm] Warning: extraneous export ${JSON.stringify(name)}`
			console.log(chalk.yellow(extraneousExportWarning))
			warnings.push(extraneousExportWarning)
			handle.dispose()
		}

		return mergeValidationResults6(
			validateModels(context, modelsHandle),
			validateActions(context, actionsHandle),
			validateContracts(context, providers, options, contractsHandle),
			validateRoutes(context, routesHandle),
			validateComponents(context, componentHandle),
			validateSources(context, sourcesHandle)
		)
	}

	constructor(
		public readonly uri: string,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		moduleHandle: QuickJSHandle,
		providers: Record<string, BlockProvider>,
		options: VMOptions
	) {
		const validationResult = VM.validate(context, moduleHandle, providers, options)

		if (isLeft(validationResult)) {
			throw Error(validationResult.left[0].message)
		} else {
			const validatedData = validationResult.right
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

function validate<T>(type: t.Type<T>, value: any, message?: string): T {
	if (type.is(value)) {
		return value
	} else {
		throw new Error(message)
	}
}
