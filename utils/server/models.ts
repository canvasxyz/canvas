import assert from "node:assert"

import { ModelType, ModelValue } from "./types"

export function validateType(type: ModelType, value: ModelValue) {
	if (type === "boolean") {
		assert(typeof value === "boolean", "invalid type: expected boolean")
	} else if (type === "string") {
		assert(typeof value === "string", "invalid type: expected string")
	} else if (type === "integer") {
		assert(Number.isSafeInteger(value), "invalid type: expected integer")
	} else if (type === "float") {
		assert(typeof value === "number", "invalid type: expected number")
	} else if (type === "bytes") {
		assert(value instanceof Uint8Array, "invalid type: expected Uint8Array")
	} else if (type === "datetime") {
		assert(typeof value === "number", "invalid type: expected number")
	} else {
		throw new Error("invalid model type", type)
		// // reference values are represented as strings
		// assert(typeof value === "string", "invalid type: expected string")
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
		case "bytes":
			return "BLOB"
		case "datetime":
			return "INTEGER"
		default:
			throw new Error("invalid model type", type)
		// const [_, tableName] = match(type, /^@([a-z0-9]+)$/, "invalid field type")
		// return `TEXT NOT NULL REFERENCES ${tableName}(id)`
	}
}
