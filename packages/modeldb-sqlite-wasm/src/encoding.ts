import * as json from "@ipld/dag-json"

import type {
	PrimitiveType,
	PrimaryKeyValue,
	PrimitiveProperty,
	PrimitiveValue,
	PropertyValue,
	PropertyEncoder,
	PropertyDecoder,
} from "@canvas-js/modeldb"

import { assert, signalInvalidType } from "@canvas-js/utils"

export type SqlitePrimitiveValue = null | number | string | Uint8Array

export const Encoder = {
	encodePrimitiveValue(
		propertyName: string,
		type: PrimitiveType,
		nullable: boolean,
		value: PropertyValue,
	): SqlitePrimitiveValue {
		if (value === null) {
			if (nullable) {
				return null
			} else if (type === "json") {
				return "null"
			} else {
				throw new TypeError(`${propertyName} cannot be null`)
			}
		} else if (type === "integer") {
			if (typeof value === "number" && Number.isSafeInteger(value)) {
				return value
			} else {
				throw new TypeError(`${propertyName} must be a safely representable integer`)
			}
		} else if (type === "number" || type === "float") {
			if (typeof value === "number") {
				return value
			} else {
				throw new TypeError(`${propertyName} must be a number`)
			}
		} else if (type === "string") {
			if (typeof value === "string") {
				return value
			} else {
				throw new TypeError(`${propertyName} must be a string`)
			}
		} else if (type === "bytes") {
			if (value instanceof Uint8Array) {
				return value
			} else {
				throw new TypeError(`${propertyName} must be a Uint8Array`)
			}
		} else if (type === "boolean") {
			if (typeof value === "boolean") {
				return value ? 1 : 0
			} else {
				throw new TypeError(`${propertyName} must be a boolean`)
			}
		} else if (type === "json") {
			try {
				return json.stringify(value)
			} catch (e) {
				throw new TypeError(`${propertyName} must be IPLD-encodable`)
			}
		} else {
			signalInvalidType(type)
		}
	},

	encodeReferenceValue(
		propertyName: string,
		target: PrimitiveProperty[],
		nullable: boolean,
		value: PropertyValue,
	): SqlitePrimitiveValue[] {
		if (value === null) {
			if (nullable) {
				return Array.from<null>({ length: target.length }).fill(null)
			} else {
				throw new TypeError(`${propertyName} cannot be null`)
			}
		}

		const wrappedValue = Array.isArray(value) ? value : [value]
		if (wrappedValue.length !== target.length) {
			throw new TypeError(`${propertyName} - expected primary key with ${target.length} components`)
		}

		return target.map(({ name, type }, i) => this.encodePrimitiveValue(name, type, false, wrappedValue[i]))
	},
} satisfies PropertyEncoder<SqlitePrimitiveValue>

export const Decoder = {
	decodePrimitiveValue(
		propertyName: string,
		type: PrimitiveType,
		nullable: boolean,
		value: SqlitePrimitiveValue,
	): PrimitiveValue {
		if (value === null) {
			if (nullable) {
				return null
			} else {
				throw new Error(`internal error - missing ${propertyName} value`)
			}
		}

		if (type === "integer") {
			if (typeof value === "number" && Number.isSafeInteger(value)) {
				return value
			} else {
				console.error("expected integer, got", value)
				throw new Error(`internal error - invalid ${propertyName} value (expected integer)`)
			}
		} else if (type === "number" || type === "float") {
			if (typeof value === "number") {
				return value
			} else {
				console.error("expected float, got", value)
				throw new Error(`internal error - invalid ${propertyName} value (expected float)`)
			}
		} else if (type === "string") {
			if (typeof value === "string") {
				return value
			} else {
				console.error("expected string, got", value)
				throw new Error(`internal error - invalid ${propertyName} value (expected string)`)
			}
		} else if (type === "bytes") {
			if (value instanceof Uint8Array) {
				return value
			} else {
				throw new Error(`internal error - invalid ${propertyName} value (expected bytes)`)
			}
		} else if (type === "boolean") {
			if (typeof value === "number") {
				return value === 1
			} else {
				throw new Error(`internal error - invalid ${propertyName} value (expected 0 or 1)`)
			}
		} else if (type === "json") {
			assert(typeof value === "string", 'internal error - expected typeof value === "string"')
			try {
				return json.parse<PrimitiveValue>(value)
			} catch (e) {
				console.error("internal error - invalid dag-json", value)
				throw new Error(`internal error - invalid ${propertyName} value (expected dag-json)`)
			}
		} else {
			signalInvalidType(type)
		}
	},

	decodeReferenceValue(
		propertyName: string,
		nullable: boolean,
		target: PrimitiveProperty[],
		values: SqlitePrimitiveValue[],
	): PrimaryKeyValue | PrimaryKeyValue[] | null {
		if (values.every((value) => value === null)) {
			if (nullable) {
				return null
			} else {
				throw new Error(`internal error - missing ${propertyName} value`)
			}
		}

		const result = target.map(
			({ name, type }, i) => this.decodePrimitiveValue(name, type, false, values[i]) as PrimaryKeyValue,
		)

		if (result.length === 1) {
			return result[0]
		} else {
			return result
		}
	},
} satisfies PropertyDecoder<SqlitePrimitiveValue>
