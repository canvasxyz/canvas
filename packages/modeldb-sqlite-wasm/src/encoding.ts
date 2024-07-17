import * as json from "@ipld/dag-json"

import type {
	Model,
	ModelValue,
	PrimaryKeyProperty,
	PrimaryKeyValue,
	PrimitiveProperty,
	PrimitiveValue,
	PropertyValue,
	ReferenceProperty,
} from "@canvas-js/modeldb"

import { assert, signalInvalidType } from "@canvas-js/utils"
import { SqlValue } from "@sqlite.org/sqlite-wasm"

export function encodeRecordParams(
	model: Model,
	value: ModelValue,
	params: Record<string, `p${string}`>,
): { [arg: `:p${string}`]: SqlValue } {
	const values: Record<`:p${string}`, SqlValue> = {}

	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing value for property ${model.name}/${property.name}`)
		}

		const param = `:${params[property.name]}` as const
		if (property.kind === "primary") {
			values[param] = encodePrimaryKeyValue(model.name, property, value[property.name])
		} else if (property.kind === "primitive") {
			values[param] = encodePrimitiveValue(model.name, property, value[property.name])
		} else if (property.kind === "reference") {
			values[param] = encodeReferenceValue(model.name, property, value[property.name])
		} else if (property.kind === "relation") {
			assert(Array.isArray(value[property.name]))
			continue
		} else {
			signalInvalidType(property)
		}
	}

	return values
}

function encodePrimaryKeyValue(modelName: string, property: PrimaryKeyProperty, value: PropertyValue): string {
	if (typeof value === "string") {
		return value
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a string`)
	}
}

function encodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: PropertyValue): SqlValue {
	if (value === null) {
		if (property.optional) {
			return null
		} else if (property.type === "json") {
			return "null"
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a safely representable integer`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a number`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (property.type === "bytes") {
		if (value instanceof Uint8Array) {
			return Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else if (property.type === "boolean") {
		if (typeof value === "boolean") {
			return value ? 1 : 0
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a boolean`)
		}
	} else if (property.type == "json") {
		try {
			return json.stringify(value)
		} catch (e) {
			throw new TypeError(`${modelName}/${property.name} must be IPLD-encodable`)
		}
	} else {
		const _: never = property.type
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

function encodeReferenceValue(modelName: string, property: ReferenceProperty, value: PropertyValue): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a string`)
	}
}

export function decodeRecord(model: Model, record: Record<string, SqlValue>): ModelValue {
	const value: ModelValue = {}

	for (const property of model.properties) {
		if (property.kind === "primary") {
			value[property.name] = decodePrimaryKeyValue(model.name, property, record[property.name])
		} else if (property.kind === "primitive") {
			value[property.name] = decodePrimitiveValue(model.name, property, record[property.name])
		} else if (property.kind === "reference") {
			value[property.name] = decodeReferenceValue(model.name, property, record[property.name])
		} else if (property.kind === "relation") {
			continue
		} else {
			signalInvalidType(property)
		}
	}

	return value
}

export function decodePrimaryKeyValue(
	modelName: string,
	property: PrimaryKeyProperty,
	value: SqlValue,
): PrimaryKeyValue {
	if (typeof value !== "string") {
		throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
	}

	return value
}

export function decodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: SqlValue) {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new Error(`internal error - missing ${modelName}/${property.name} value`)
		}
	}

	if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value
		} else {
			console.error("expected integer, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected integer)`)
		}
	} else if (property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			console.error("expected float, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected float)`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			console.error("expected string, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
		}
	} else if (property.type === "bytes") {
		if (Buffer.isBuffer(value)) {
			return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		} else {
			console.error("expected Uint8Array, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected Uint8Array)`)
		}
	} else if (property.type == "boolean") {
		if (typeof value === "number") {
			return value === 1
		} else {
			console.error("expected boolean, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected boolean)`)
		}
	} else if (property.type == "json") {
		assert(typeof value === "string", 'internal error - expected typeof value === "string"')
		try {
			return json.parse<PrimitiveValue>(value)
		} catch (e) {
			console.error("internal error - invalid dag-json", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected dag-json)`)
		}
	} else {
		const _: never = property.type
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

export function decodeReferenceValue(modelName: string, property: ReferenceProperty, value: SqlValue): string | null {
	if (value === null) {
		if (property.optional) {
			return null
		} else {
			throw new TypeError(`internal error - missing ${modelName}/${property.name} value`)
		}
	} else if (typeof value === "string") {
		return value
	} else {
		throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
	}
}
