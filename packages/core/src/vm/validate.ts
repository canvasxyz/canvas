import chalk from "chalk"
import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten"
import { ethers } from "ethers"

import { ContractMetadata, Model, BlockProvider, Chain } from "@canvas-js/interfaces"
import { EthereumBlockProvider } from "@canvas-js/verifiers"

import { contractMetadatasType, modelsType } from "../codecs.js"
import { ipfsURIPattern } from "../utils.js"

import { unwrapObject, call, unwrapArray, mergeValidationResults6 } from "./utils.js"

import { isLeft, left, right } from "fp-ts/lib/Either.js"
import { pipe } from "fp-ts/lib/function.js"

import * as t from "io-ts"
import * as R from "fp-ts/lib/Record.js"

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

	// validate models type
	const modelData = modelsHandle.consume(context.dump)
	const modelsTypeRes = modelsType.decode(modelData)

	// if there are any errors, then return
	if (isLeft(modelsTypeRes)) {
		return modelsTypeRes
	}

	const models = modelsTypeRes.right

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

	return errors.length > 0 ? left(errors) : right({ models })
}

function validateActions(
	context: QuickJSContext,
	actionsHandle?: QuickJSHandle
): t.Validation<{ actions: string[]; actionHandles: Record<string, QuickJSHandle> }> {
	if (!actionsHandle) {
		console.log("no actions handle")
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

	return errors.length > 0 ? left(errors) : right({ actions, actionHandles })
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

interface VMOptions {
	verbose?: boolean
	unchecked?: boolean
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

	return errors.length > 0 ? left(errors) : right({ contracts, contractMetadata: contractMetadatas })
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

	return errors.length > 0 ? left(errors) : right({ routes, routeHandles })
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

	return errors.length > 0 ? left(errors) : right({ sources, sourceHandles })
}

export function validateCanvasSpec(
	context: QuickJSContext,
	moduleHandle: QuickJSHandle,
	providers: Record<string, BlockProvider>,
	options: VMOptions
): {
	warnings: string[]
	validation: t.Validation<{
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
	}>
} {
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
		const extraneousExportWarning = `Warning: extraneous export ${JSON.stringify(name)}`
		console.log(chalk.yellow(`[canvas-vm] ${extraneousExportWarning}`))
		warnings.push(extraneousExportWarning)
		handle.dispose()
	}

	return {
		warnings,
		validation: mergeValidationResults6(
			validateModels(context, modelsHandle),
			validateActions(context, actionsHandle),
			validateContracts(context, providers, options, contractsHandle),
			validateRoutes(context, routesHandle),
			validateComponents(context, componentHandle),
			validateSources(context, sourcesHandle)
		),
	}
}
