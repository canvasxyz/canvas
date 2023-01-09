import assert from "node:assert"

import chalk from "chalk"
import { fetch } from "undici"
import { getQuickJS, isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten"
import { transform } from "sucrase"
import { ethers } from "ethers"

import * as t from "io-ts"
import { PathReporter } from "io-ts/lib/PathReporter.js"

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
import { chainIdType, chainType, modelsType } from "../codecs.js"
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
} from "./utils.js"

import * as constants from "../constants.js"
import { pipe } from "fp-ts/lib/function.js"
import { isRight } from "fp-ts/lib/Either.js"

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
}

interface VMConfig extends VMOptions {
	uri: string
	spec: string
	providers?: Record<string, BlockProvider>
}

type ValidateResult<ResultType> = { valid: true; result: ResultType } | { valid: false; errors: string[] }

// function validateIoTs<O>(t: t.Type<any, O, any>, v: any): ValidateResult<O> {
// 	return pipe(
// 		t.decode(v),
// 		fold(
// 			(errors) => {
// 				console.log(errors)
// 				return { valid: false, errors: errors.map((e) => e.message || "") } as ValidateResult<O>
// 			},
// 			(result) => ({ valid: true, result } as ValidateResult<O>)
// 		)
// 	)
// }

function validateModels(
	context: QuickJSContext,
	modelsHandle?: QuickJSHandle
): ValidateResult<{ models: Record<string, Model> }> {
	if (modelsHandle == undefined) {
		return {
			valid: false,
			errors: ["Spec is missing `models` export"],
		}
	}

	let models
	try {
		models = validate(modelsType, modelsHandle.consume(context.dump))
	} catch (e) {
		return {
			valid: false,
			errors: ["`models` export is invalid"],
		}
	}

	const errors = []

	const modelNamePattern = /^[a-z_]+$/
	const modelPropertyNamePattern = /^[a-z_]+$/
	for (const [name, model] of Object.entries(models)) {
		if (!modelNamePattern.test(name)) {
			errors.push(`Model name ${name} is invalid: model names must match ${modelNamePattern}`)
		}
		if (name.startsWith("_")) {
			errors.push(`Model name ${name} is invalid: model names must not begin with an underscore`)
		}

		const { indexes, ...properties } = model
		for (const property of Object.keys(properties)) {
			if (!modelPropertyNamePattern.test(property)) {
				errors.push(
					`Model property ${name}.${property} is invalid: model properties must match ${modelPropertyNamePattern}`
				)
			}

			if (property.startsWith("_")) {
				errors.push(
					`Model property ${name}.${property} is invalid: model property names must not begin with an underscore`
				)
			}
		}

		if (properties.id !== "string") {
			errors.push(`Model ${name} is invalid: models must include the property { id: string }`)
		}

		if (properties.updated_at !== "datetime") {
			errors.push(`Model ${name} is invalid: models must include the property { updated_at: datetime }`)
		}

		if (indexes !== undefined) {
			for (const index of indexes) {
				if (index == "id") {
					errors.push(`"id" index is redundant`)
				}
				const indexProperties = Array.isArray(index) ? index : [index]
				for (const property of indexProperties) {
					if (!(property in properties)) {
						errors.push(
							`Model ${name} specified an invalid index "${property}": can only index on other model properties`
						)
					}
				}
			}
		}
	}

	if (errors) {
		return { valid: false, errors }
	} else {
		return { valid: true, result: { models } }
	}
}

function validateActions(
	context: QuickJSContext,
	actionsHandle?: QuickJSHandle
): ValidateResult<{ actions: string[]; actionHandles: Record<string, QuickJSHandle> }> {
	if (!actionsHandle) {
		return {
			valid: false,
			errors: ["Spec is missing `actions` export"],
		}
	}

	if (context.typeof(actionsHandle) !== "object") {
		return {
			valid: false,
			errors: ["`actions` export must be an object"],
		}
	}

	// parse and validate action handlers
	const errors = []

	const actions: string[] = []
	const actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
	const actionNamePattern = /^[a-zA-Z]+$/
	for (const [name, handle] of Object.entries(actionHandles)) {
		if (!actionNamePattern.test(name)) {
			errors.push(`${name} is invalid: action names must match ${actionNamePattern}`)
		}

		if (context.typeof(handle) !== "function") {
			errors.push(`Action ${name} is invalid: actions.${name} is not a function`)
		}

		actions.push(name)
	}

	if (errors) {
		return { valid: false, errors }
	} else {
		return { valid: true, result: { actions, actionHandles } }
	}
}

function validateContractMetadata(
	context: QuickJSContext,
	providers: Record<string, BlockProvider>,
	options: VMOptions,
	name: string,
	contractHandle: QuickJSHandle
): ValidateResult<{ contract?: ethers.Contract; contractMetadata: ContractMetadata }> {
	const errors = []

	const contractNamePattern = /^[a-zA-Z]+$/
	if (!contractNamePattern.test(name)) {
		errors.push(`Contract ${name} is invalid: contract names must match ${contractNamePattern}`)
	}

	const contract = contractHandle.consume((handle) => unwrapObject(context, handle))
	const chain = contract.chain.consume(context.getString)
	const chainId = contract.chainId.consume(context.getNumber)
	const address = contract.address.consume(context.getString)
	const abi = contract.abi
		.consume((handle) => unwrapArray(context, handle))
		.map((item) => item.consume(context.getString))

	if (!chainType.is(chain)) {
		errors.push(`Contract ${name} is invalid: invalid chain (${chain})`)
	}

	if (!chainIdType.is(chainId)) {
		errors.push(`Contract ${name} is invalid: invalid chain id (${chainId})`)
	}

	let contractResult
	if (options.unchecked) {
		if (options.verbose) {
			console.log(`[canvas-vm] Skipping contract setup`)
		}
	} else {
		if (chain == "eth") {
			const provider = providers[`${chain}:${chainId}`]
			if (provider instanceof EthereumBlockProvider) {
				contractResult = new ethers.Contract(address, abi, provider.provider)
			} else {
				errors.push(`Contract ${name} is invalid: spec requires an RPC endpoint for ${chain}:${chainId}`)
			}
		}
	}

	if (errors) {
		return { valid: false, errors }
	} else {
		const contractMetadata = { chain: chain as Chain, chainId, address, abi }
		return {
			valid: true,
			result: {
				contractMetadata,
				contract: contractResult,
			},
		}
	}
}

function validateContracts(
	context: QuickJSContext,
	providers: Record<string, BlockProvider>,
	options: VMOptions,
	contractsHandle?: QuickJSHandle
): ValidateResult<{ contracts: Record<string, ethers.Contract>; contractMetadata: Record<string, ContractMetadata> }> {
	if (contractsHandle && context.typeof(contractsHandle) !== "object") {
		return { valid: false, errors: ["`contracts` export must be an object"] }
	}

	const contracts: Record<string, ethers.Contract> = {}
	const contractMetadata: Record<string, ContractMetadata> = {}

	let errors: string[] = []
	if (contractsHandle) {
		// parse and validate contracts
		const contractHandles = contractsHandle.consume((handle) => unwrapObject(context, handle))

		for (const [name, contractHandle] of Object.entries(contractHandles)) {
			const contractMetadataValidationResult = validateContractMetadata(
				context,
				providers,
				options,
				name,
				contractHandle
			)
			if (contractMetadataValidationResult.valid) {
				const result = contractMetadataValidationResult.result

				if (result.contract) {
					contracts[name] = result.contract
				}
				contractMetadata[name] = result.contractMetadata
			} else {
				errors.concat(contractMetadataValidationResult.errors)
			}
		}
	}
	if (errors) {
		return { valid: false, errors }
	} else {
		return { valid: true, result: { contracts, contractMetadata } }
	}
}

function validateRoutes(
	context: QuickJSContext,
	routesHandle?: QuickJSHandle
): ValidateResult<{ routes: Record<string, string[]>; routeHandles: Record<string, QuickJSHandle> }> {
	const routes: Record<string, string[]> = {}
	let routeHandles: Record<string, QuickJSHandle> = {}

	const errors = []

	if (routesHandle !== undefined) {
		if (context.typeof(routesHandle) != "object") {
			return { valid: false, errors: ["`routes` export must be an object"] }
		}

		routeHandles = routesHandle.consume((handle) => unwrapObject(context, handle))

		const routeNamePattern = /^(\/:?[a-z_]+)+$/
		const routeParameterPattern = /:([a-zA-Z0-9_]+)/g

		for (const [name, handle] of Object.entries(routeHandles)) {
			if (!routeNamePattern.test(name)) {
				errors.push(`Route ${name} is invalid: the name must match the regex ${routeNamePattern}`)
			}

			if (context.typeof(handle) !== "function") {
				errors.push(`Route ${name} is invalid: the route must be a function`)
			}

			routes[name] = []
			for (const [_, param] of name.matchAll(routeParameterPattern)) {
				routes[name].push(param)
			}
		}
	}

	if (errors) {
		return { valid: false, errors }
	} else {
		return { valid: true, result: { routes, routeHandles } }
	}
}

function validateComponents(
	context: QuickJSContext,
	componentHandle: QuickJSHandle
): ValidateResult<{ component: string | null }> {
	let component: string | null = null

	if (componentHandle) {
		if (context.typeof(componentHandle) !== "function") {
			return {
				valid: false,
				errors: ["`component` export must be a function"],
			}
		}

		component = call(context, "Function.prototype.toString", componentHandle).consume(context.getString)
		componentHandle.dispose()
	}
	return {
		valid: true,
		result: { component },
	}
}

function validateSources(
	context: QuickJSContext,
	sourcesHandle: QuickJSHandle
): ValidateResult<{ sources: Set<string>; sourceHandles: Record<string, Record<string, QuickJSHandle>> }> {
	if (sourcesHandle && context.typeof(sourcesHandle) !== "object") {
		return { valid: false, errors: ["`sources` export must be an object"] }
	}

	const sourceHandles: Record<string, Record<string, QuickJSHandle>> = {}
	const sources = new Set<string>()
	const errors = []

	if (sourcesHandle !== undefined) {
		for (const [source, sourceHandle] of Object.entries(
			sourcesHandle.consume((handle) => unwrapObject(context, handle))
		)) {
			if (!ipfsURIPattern.test(source)) {
				errors.push(`Source ${source} is invalid: the keys must be ipfs:// URIs`)
			}
			if (context.typeof(sourceHandle) !== "object") {
				errors.push(`Source ${source} is invalid: sources["${source}"] must be an object`)
			}

			sourceHandles[source] = sourceHandle.consume((handle) => unwrapObject(context, handle))
			sources.add(source)
			for (const [name, handle] of Object.entries(sourceHandles[source])) {
				if (context.typeof(handle) !== "function")
					errors.push(`sources["${source}"].${name} is invalid: sources["${source}"].${name} is not a function`)
			}
		}
	}
	if (errors) {
		return { valid: false, errors }
	} else {
		return { valid: true, result: { sources, sourceHandles } }
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
	): ValidateResult<{
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

		const modelsValidationResult = validateModels(context, modelsHandle)
		const actionsValidationResult = validateActions(context, actionsHandle)
		const contractsValidationResult = validateContracts(context, providers, options, contractsHandle)
		const routesValidationResult = validateRoutes(context, routesHandle)
		const componentsValidationResult = validateComponents(context, componentHandle)
		const sourcesValidationResult = validateSources(context, sourcesHandle)

		// if all of the checks have passed, return the extracted values
		if (
			modelsValidationResult.valid &&
			actionsValidationResult.valid &&
			contractsValidationResult.valid &&
			routesValidationResult.valid &&
			componentsValidationResult.valid &&
			sourcesValidationResult.valid
		) {
			return {
				valid: true,
				result: {
					models: modelsValidationResult.result.models,
					actionHandles: actionsValidationResult.result.actionHandles,
					actions: actionsValidationResult.result.actions,
					contractMetadata: contractsValidationResult.result.contractMetadata,
					contracts: contractsValidationResult.result.contracts,
					routeHandles: routesValidationResult.result.routeHandles,
					routes: routesValidationResult.result.routes,
					component: componentsValidationResult.result.component,
					sourceHandles: sourcesValidationResult.result.sourceHandles,
					sources: sourcesValidationResult.result.sources,
				},
			}
		} else {
			// otherwise, collect the errors and return them
			const validationResults = [
				modelsValidationResult,
				actionsValidationResult,
				contractsValidationResult,
				routesValidationResult,
				componentsValidationResult,
				sourcesValidationResult,
			]

			let errors: string[] = []
			for (const validationResult of validationResults) {
				if (!validationResult.valid) {
					errors = errors.concat(validationResult.errors)
				}
			}

			return { valid: false, errors }
		}
	}

	constructor(
		public readonly uri: string,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		moduleHandle: QuickJSHandle,
		providers: Record<string, BlockProvider>,
		options: VMOptions
	) {
		// call validation code here

		const validationResult = VM.validate(context, moduleHandle, providers, options)
		if (!validationResult.valid) {
			throw Error(validationResult.errors[0])
		} else {
			this.models = validationResult.result.models
			this.actions = validationResult.result.actions
			this.routes = validationResult.result.routes
			this.contracts = validationResult.result.contracts
			this.contractMetadata = validationResult.result.contractMetadata
			this.component = validationResult.result.component
			this.sources = validationResult.result.sources
			this.routeHandles = validationResult.result.routeHandles
			this.actionHandles = validationResult.result.actionHandles
			this.sourceHandles = validationResult.result.sourceHandles
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

const assertPattern = (value: string, pattern: RegExp, message: string) =>
	assert(pattern.test(value), `${message}: ${JSON.stringify(value)} does not match pattern ${pattern.source}`)
