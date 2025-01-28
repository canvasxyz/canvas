import pg from "pg"

import * as json from "@ipld/dag-json"

import { assert, signalInvalidType } from "@canvas-js/utils"

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

export type PostgresPrimitiveValue = string | number | boolean | Buffer | null
export type RecordParams = Record<`p${string}`, PostgresPrimitiveValue>

export const fromBuffer = (data: Buffer): Uint8Array => new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
export const toBuffer = (data: Uint8Array) => Buffer.from(data.buffer, data.byteOffset, data.byteLength)

export function encodePrimaryKey(value: PrimaryKeyValue): PostgresPrimitiveValue {
	if (value instanceof Uint8Array) {
		return toBuffer(value)
	} else {
		return value
	}
}

export function decodePrimaryKey(value: PostgresPrimitiveValue): PrimaryKeyValue {
	if (typeof value === "string" || typeof value === "number") {
		return value
	} else if (value instanceof Uint8Array) {
		return toBuffer(value)
	} else {
		throw new Error(`internal error - invalid primary key value (${value})`)
	}
}

export function encodeQueryParams(params: PrimitiveValue[]): PostgresPrimitiveValue[] {
	return params.map((param) => {
		if (param instanceof Uint8Array) {
			return toBuffer(param)
		} else {
			return param
		}
	})
}

export function encodePrimitiveValue(
	modelName: string,
	property: PrimitiveProperty,
	value: PropertyValue,
): PostgresPrimitiveValue {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (property.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value.toString(10)
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
			return value ? true : false
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a boolean`)
		}
	} else if (property.type === "json") {
		try {
			return JSON.parse(json.stringify(value))
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
	target: PrimitiveProperty,
): string | number | Buffer | null {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (target.type === "integer") {
		if (typeof value === "number" && Number.isSafeInteger(value)) {
			return value.toString(10)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be an integer`)
		}
	} else if (target.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else if (target.type === "bytes") {
		if (value instanceof Uint8Array) {
			return toBuffer(value)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else {
		throw new Error(`internal error - invalid reference target type`)
	}
}

export function decodePrimitiveValue(modelName: string, property: PrimitiveProperty, value: PostgresPrimitiveValue) {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new Error(`internal error - missing ${modelName}/${property.name} value`)
		}
	}

	if (property.type === "integer") {
		if (typeof value === "string") {
			return parseInt(value, 10)
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected integer)`)
		}
	} else if (property.type === "number" || property.type === "float") {
		if (typeof value === "number") {
			return value
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected float)`)
		}
	} else if (property.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected string)`)
		}
	} else if (property.type === "bytes") {
		if (Buffer.isBuffer(value)) {
			return fromBuffer(value)
		} else {
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected Uint8Array)`)
		}
	} else if (property.type === "boolean") {
		if (typeof value === "boolean") {
			return value === true
		} else {
			console.error("expected boolean, got", value)
			throw new Error(`internal error - invalid ${modelName}/${property.name} value (expected boolean)`)
		}
	} else if (property.type === "json") {
		try {
			return json.decode(json.encode(value))
		} catch (err) {
			return value
		}
	} else {
		const _: never = property.type
		throw new Error(`internal error - unknown primitive type ${JSON.stringify(property.type)}`)
	}
}

export function decodeReferenceValue(
	modelName: string,
	property: ReferenceProperty,
	value: PostgresPrimitiveValue,
	target: PrimitiveProperty,
): PrimaryKeyValue | null {
	if (value === null) {
		if (property.nullable) {
			return null
		} else {
			throw new TypeError(`${modelName}/${property.name} cannot be null`)
		}
	} else if (target.type === "integer") {
		if (typeof value === "string") {
			return parseInt(value, 10)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be an integer`)
		}
	} else if (target.type === "string") {
		if (typeof value === "string") {
			return value
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (target.type === "bytes") {
		if (Buffer.isBuffer(value)) {
			return fromBuffer(value)
		} else {
			throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
		}
	} else {
		throw new Error(`internal error - invalid reference target type`)
	}
}
