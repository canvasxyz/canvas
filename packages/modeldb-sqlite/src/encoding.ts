import * as json from "@ipld/dag-json"

import {
	isPrimaryKey,
	PrimaryKeyValue,
	Model,
	ModelValue,
	PrimitiveProperty,
	PrimitiveValue,
	PropertyValue,
	ReferenceProperty,
} from "@canvas-js/modeldb"

import { assert, mapValues, signalInvalidType } from "@canvas-js/utils"

// this is the type of a primitive value as stored in sqlite
// this may not match onto the types in the model
// because sqlite does not natively support all of the types we might want
// for example, sqlite does not have a boolean or a json type
export type SqlitePrimitiveValue = string | number | Buffer | null

export type RecordValue = Record<string, SqlitePrimitiveValue>
export type RecordParams = Record<`p${string}`, SqlitePrimitiveValue>

const fromBuffer = (data: Buffer): Uint8Array => new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
const toBuffer = (data: Uint8Array) => Buffer.from(data.buffer, data.byteOffset, data.byteLength)

export function encodePrimaryKey(value: PrimaryKeyValue): SqlitePrimitiveValue {
	if (value instanceof Uint8Array) {
		return toBuffer(value)
	} else {
		return value
	}
}

export function decodePrimaryKey(value: SqlitePrimitiveValue): PrimaryKeyValue {
	assert(value !== null, "internal error decoding primary key: expected value !== null")
	if (Buffer.isBuffer(value)) {
		return fromBuffer(value)
	} else {
		return value
	}
}

export function encodeQueryParams(params: Record<string, PrimitiveValue>): Record<string, SqlitePrimitiveValue> {
	return mapValues(params, (value) => {
		if (typeof value === "boolean") {
			return value ? 1 : 0
		} else if (value instanceof Uint8Array) {
			return toBuffer(value)
		} else {
			return value
		}
	})
}

export function encodeRecordParams(
	model: Model,
	value: ModelValue,
	params: Record<string, `p${string}`>,
): Record<`p${string}`, SqlitePrimitiveValue> {
	const values: RecordParams = {}

	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing value for property ${model.name}/${property.name}`)
		}

		const param = params[property.name]
		if (property.kind === "primitive") {
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

function encodePrimitiveValue(
	modelName: string,
	property: PrimitiveProperty,
	value: PropertyValue,
): SqlitePrimitiveValue {
	if (value === null) {
		if (property.nullable) {
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
	} else if (property.type === "number" || property.type === "float") {
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
			return toBuffer(value)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else if (property.type === "boolean") {
		if (typeof value === "boolean") {
			return value ? 1 : 0
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a boolean`)
		}
	} else if (property.type === "json") {
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

export function encodeReferenceValue(
	modelName: string,
	property: ReferenceProperty,
	value: PropertyValue,
): SqlitePrimitiveValue {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (isPrimaryKey(value)) {
		return encodePrimaryKey(value)
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a primary key`)
	}
}

export function decodeRecord(model: Model, record: Record<string, SqlitePrimitiveValue>): ModelValue {
	const value: ModelValue = {}

	for (const property of model.properties) {
		if (property.kind === "primitive") {
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

export function decodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: SqlitePrimitiveValue) {
	if (value === null) {
		if (property.nullable) {
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
	} else if (property.type === "number" || property.type === "float") {
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
			return fromBuffer(value)
		} else {
			console.error("expected Uint8Array, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected Uint8Array)`)
		}
	} else if (property.type === "boolean") {
		if (typeof value === "number") {
			return value === 1
		} else {
			console.error("expected boolean, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected boolean)`)
		}
	} else if (property.type === "json") {
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

export function decodeReferenceValue(
	modelName: string,
	property: ReferenceProperty,
	value: SqlitePrimitiveValue,
): PrimaryKeyValue | null {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`internal error - missing ${modelName}/${property.name} value`)
		}
	} else if (Buffer.isBuffer(value)) {
		return fromBuffer(value)
	} else {
		return value
	}
}
