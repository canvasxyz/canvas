import type { SqlStorageValue } from "@cloudflare/workers-types"

import * as json from "@ipld/dag-json"

import {
	isPrimaryKey,
	Model,
	ModelValue,
	PrimaryKeyValue,
	PrimitiveProperty,
	PrimitiveValue,
	PropertyValue,
	ReferenceProperty,
} from "@canvas-js/modeldb"

import { assert, signalInvalidType } from "@canvas-js/utils"

export type RecordValue = Record<string, SqlStorageValue>
export type RecordParams = SqlStorageValue[]

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
	if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
		return data.buffer
	} else {
		const buffer = new ArrayBuffer(data.byteLength)
		new Uint8Array(buffer).set(data)
		return buffer
	}
}

export function fromArrayBuffer(data: ArrayBuffer): Uint8Array {
	return new Uint8Array(data, 0, data.byteLength)
}

export function encodeQueryParams(params: PrimitiveValue[]): SqlStorageValue[] {
	return params.map((value) => {
		if (typeof value === "boolean") {
			return value ? 1 : 0
		} else if (value instanceof Uint8Array) {
			return toArrayBuffer(value)
		} else {
			return value
		}
	})
}

export function encodeRecordParams(model: Model, value: ModelValue): SqlStorageValue[] {
	const result: SqlStorageValue[] = []

	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing value for property ${model.name}/${property.name}`)
		}

		if (property.kind === "primitive") {
			result.push(encodePrimitiveValue(model.name, property, value[property.name]))
		} else if (property.kind === "reference") {
			result.push(encodeReferenceValue(model.name, property, value[property.name]))
		} else if (property.kind === "relation") {
			// TODO: add test for relation
			assert(Array.isArray(value[property.name]))
			continue
		} else {
			signalInvalidType(property)
		}
	}

	return result
}

function encodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: PropertyValue): SqlStorageValue {
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
			return toArrayBuffer(value)
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

function encodeReferenceValue(modelName: string, property: ReferenceProperty, value: PropertyValue): SqlStorageValue {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (isPrimaryKey(value)) {
		return value
	} else {
		throw new TypeError(`${modelName}/${property.name} must be a primary key`)
	}
}

export function decodeRecord(model: Model, record: Record<string, SqlStorageValue>): ModelValue {
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

export function decodePrimitiveValue(
	modelName: string,
	property: PrimitiveProperty,
	value: SqlStorageValue,
): PrimitiveValue {
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
		if (value instanceof ArrayBuffer) {
			return fromArrayBuffer(value)
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected ArrayBuffer)`)
		}
	} else if (property.type === "boolean") {
		if (typeof value === "number") {
			return value === 1
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected 0 or 1)`)
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
	value: SqlStorageValue,
): PrimaryKeyValue | null {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`internal error - missing ${modelName}/${property.name} value`)
		}
	} else if (value instanceof ArrayBuffer) {
		return fromArrayBuffer(value)
	} else {
		return value
	}
}
