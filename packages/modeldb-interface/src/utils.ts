import { blake3 } from "@noble/hashes/blake3"
import { encode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"

import type { Model, ModelValue, Property, PropertyValue } from "./types.js"

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const DEFAULT_DIGEST_LENGTH = 16

export function getImmutableRecordKey(value: ModelValue, options: { namespace?: string }): string {
	const bytes = encode(value)
	const hash = blake3(bytes, { dkLen: DEFAULT_DIGEST_LENGTH })
	const key = base58btc.baseEncode(hash)
	if (options.namespace === undefined) {
		return key
	} else {
		return `${options.namespace}/${key}`
	}
}

export function validateModelValue(model: Model, value: ModelValue) {
	for (const property of model.properties) {
		const propertyValue = value[property.name]
		assert(propertyValue !== undefined, `model value is missing property ${property.name}`)
		validatePropertyValue(model.name, property, propertyValue)
	}
}

export function validatePropertyValue(modelName: string, property: Property, value: PropertyValue) {
	if (property.kind === "primitive") {
		if (property.optional && value === null) {
			return
		} else if (property.type === "integer") {
			assert(
				typeof value === "number" && Number.isSafeInteger(value),
				`${modelName}/${property.name} must be an integer`
			)
		} else if (property.type === "float") {
			assert(typeof value === "number", `${modelName}/${property.name} must be a float`)
		} else if (property.type === "string") {
			assert(typeof value === "string", `${modelName}/${property.name} must be a string`)
		} else if (property.type === "bytes") {
			assert(value instanceof Uint8Array, `${modelName}/${property.name} must be a Uint8Array`)
		} else {
			signalInvalidType(property.type)
		}
	} else if (property.kind === "reference") {
		if (property.optional && value === null) {
			return
		} else {
			assert(typeof value === "string", `${modelName}/${property.name} must be a string ID`)
		}
	} else if (property.kind === "relation") {
		assert(
			Array.isArray(value) && value.every((value) => typeof value === "string"),
			`${modelName}/${property.name} must be an array of string IDs`
		)
	} else {
		signalInvalidType(property)
	}
}
