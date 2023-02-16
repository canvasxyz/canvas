import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten"

import * as t from "io-ts"
import { isLeft } from "fp-ts/lib/Either.js"

import { Chain } from "@canvas-js/interfaces"

import { ipfsURIPattern } from "../utils.js"
import { chainType, chainIdType, modelsType } from "../codecs.js"

import { unwrapObject, call } from "./utils.js"

import { Exports, disposeExports } from "./exports.js"

export function validateCanvasSpec(
	context: QuickJSContext,
	moduleHandle: QuickJSHandle
): { exports: Exports | null; errors: string[]; warnings: string[] } {
	const {
		name: nameHandle,
		models: modelsHandle,
		routes: routesHandle,
		actions: actionsHandle,
		contracts: contractsHandle,
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
			errors.push({ value: null, context: [], message })
		}
		return cond
	}

	const exports: Exports = {
		name: null,
		models: {},
		contractMetadata: {},
		routeHandles: {},
		actionHandles: {},
		sourceHandles: {},
	}

	for (const [name, handle] of Object.entries(rest)) {
		warnings.push(`extraneous export \`${name}\``)
		handle.dispose()
	}

	// validate name
	if (nameHandle) {
		assertLogError(context.typeof(nameHandle) === "string", "`name` export must be a string if provided")
		exports.name = nameHandle.consume(context.dump)
	} else {
		exports.name = null
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
			exports: null,
			errors: errors.flatMap((err) => (err.message ? [err.message] : [])),
			warnings,
		}
	} else {
		return { exports, errors: [], warnings }
	}
}
