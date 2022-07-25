import assert from "node:assert"

import type { ModelType, ModelValue } from "@canvas-js/interfaces"

export const SQL_QUERY_LIMIT = 20

export type JSONValue = null | string | number | boolean | JSONArray | JSONObject
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
	[key: string]: JSONValue
}

export const mapEntries = <S, T>(object: Record<string, S>, map: (key: string, value: S) => T): Record<string, T> =>
	Object.fromEntries(Object.entries(object).map(([key, value]) => [key, map(key, value)]))

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function validateType(type: ModelType, value: ModelValue) {
	if (type === "boolean") {
		assert(typeof value === "boolean", "invalid type: expected boolean")
	} else if (type === "string") {
		assert(typeof value === "string", "invalid type: expected string")
	} else if (type === "integer") {
		assert(Number.isSafeInteger(value), "invalid type: expected integer")
	} else if (type === "float") {
		assert(typeof value === "number", "invalid type: expected number")
	} else if (type === "datetime") {
		assert(typeof value === "number", "invalid type: expected number")
	} else {
		signalInvalidType(type)
	}
}

// export async function* createPrefixStream<T extends string | Uint8Array = string | Uint8Array>(
// 	db: HyperBee,
// 	prefix: string,
// 	options: { limit?: number } = {}
// ): AsyncIterable<[string, T]> {
// 	const limit = options.limit === undefined || options.limit === -1 ? Infinity : options.limit
// 	if (limit === 0) {
// 		return
// 	}

// 	const deletedKeys = new Set()
// 	let n = 0
// 	for await (const { type, key, value } of db.createHistoryStream({ reverse: true })) {
// 		if (typeof key === "string" && key.startsWith(prefix)) {
// 			if (type === "del") {
// 				deletedKeys.add(key)
// 			} else if (type === "put") {
// 				if (deletedKeys.has(key)) {
// 					continue
// 				} else {
// 					yield [key, value as T]
// 					n++
// 					if (n >= limit) {
// 						return
// 					}
// 				}
// 			}
// 		}
// 	}
// }

// /**
//  * Recursively clones objects, using Function.prototype.toString() to stringify
//  * functions, and JSON.stringify to stringify everything else.
//  */
// const recursiveClone = (obj: Record<string, any>) => {
// 	const clone: Record<string, any> = {}
// 	for (const i in obj) {
// 		if (obj[i] !== null && typeof obj[i] === "object") {
// 			clone[i] = recursiveClone(obj[i])
// 		} else if (typeof obj[i] === "function") {
// 			clone[i] = obj[i].toString()
// 		} else if (typeof obj[i] === "number") {
// 			clone[i] = obj[i]
// 		} else if (typeof obj[i] === "string") {
// 			clone[i] = obj[i]
// 		} else if (typeof obj[i] === "boolean") {
// 			clone[i] = obj[i]
// 		} else {
// 			clone[i] = JSON.stringify(obj[i])
// 		}
// 	}
// 	return clone
// }

// export function objectSpecToString(obj: ObjectSpec): string {
// 	return `
// export const models = ${JSON.stringify(recursiveClone(obj.models), null, "  ")};
// export const routes = ${JSON.stringify(recursiveClone(obj.routes), null, "  ")};
// export const actions = {
//   ${Object.entries(obj.actions)
// 		.map(([name, action]) => specFunctionToString(name, action))
// 		.join(",\n  ")}
// }
// `
// }

// const functionPrefix = "function "

// function specFunctionToString(name: string, f: (...args: any[]) => void) {
// 	let source = f.toString()
// 	if (source.startsWith(functionPrefix)) {
// 		source = source.slice(functionPrefix.length)
// 	}
// 	if (source.startsWith(name)) {
// 		source = source.slice(name.length)
// 	}
// 	return JSON.stringify(name) + source
// }

// function getFunctionParameters(source: string) {
// 	return source
// 		.replace(/[/][/].*$/gm, "") // strip single-line comments
// 		.replace(/\s+/g, "") // strip white space
// 		.replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
// 		.split("){", 1)[0]
// 		.replace(/^[^(]*[(]/, "") // extract the parameters
// 		.replace(/=[^,]+/g, "") // strip any ES6 defaults
// 		.split(",")
// 		.filter(Boolean) // split & filter [""]
// }
