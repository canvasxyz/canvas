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
