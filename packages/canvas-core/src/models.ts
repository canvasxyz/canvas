import * as t from "io-ts"

import { assert } from "./utils.js"

/**
 * A `ModelType` is a runtime representation of an abstract model field type,
 * ie string values that we use to set the sqlite schema and coerce
 * action arguments.
 */
export type ModelType = "boolean" | "string" | "integer" | "float" | "datetime"

export const modelTypeType: t.Type<ModelType> = t.union([
	t.literal("boolean"),
	t.literal("string"),
	t.literal("integer"),
	t.literal("float"),
	t.literal("datetime"),
])

/**
 *  A `ModelValue` is a type-level representation of concrete model field types, ie
 * a TypeScript type that describes the possible JavaScript values that instantiate
 * the various ModelType options.
 */
export type ModelValue = null | boolean | number | string

export const modelValueType = t.union([t.null, t.boolean, t.number, t.string])

export type Model = Record<string, ModelType>

export const modelType = t.record(t.string, modelTypeType)

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
		console.error(type)
		throw new Error("invalid model type")
	}
}

export function getColumnType(type: ModelType): string {
	switch (type) {
		case "boolean":
			return "INTEGER"
		case "string":
			return "TEXT"
		case "integer":
			return "INTEGER"
		case "float":
			return "FLOAT"
		case "datetime":
			return "INTEGER"
		default:
			console.error(type)
			throw new Error("invalid model type")
	}
}
