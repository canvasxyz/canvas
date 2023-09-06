import { base58btc } from "multiformats/bases/base58"

import { getCID } from "@canvas-js/signed-cid"

import type {
	Context,
	Model,
	ModelValue,
	NotExpression,
	PrimitiveValue,
	Property,
	PropertyValue,
	RangeExpression,
	Resolver,
} from "./types.js"

export type Awaitable<T> = T | Promise<T>

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

export function getImmutableRecordKey(value: ModelValue): string {
	const cid = getCID(value, { codec: "dag-cbor", digest: "blake3-128" })
	return cid.toString(base58btc)
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

export const defaultResolver: Resolver = { lessThan }

// TODO: make absolutely sure this does what we want
function lessThan({ version: a }: Context, { version: b }: Context) {
	if (b === null) {
		return false
	} else if (a === null) {
		return true
	}

	let x = a.length
	let y = b.length
	for (let i = 0, len = Math.min(x, y); i < len; ++i) {
		if (a[i] !== b[i]) {
			x = a[i]
			y = b[i]
			break
		}
	}
	return x < y
}

export function isPrimitiveValue(expr: PrimitiveValue | NotExpression | RangeExpression): expr is PrimitiveValue {
	if (expr === null) {
		return true
	} else if (typeof expr === "boolean" || typeof expr === "number" || typeof expr === "string") {
		return true
	} else if (expr instanceof Uint8Array) {
		return true
	} else {
		return false
	}
}

export function isNotExpression(expr: PrimitiveValue | NotExpression | RangeExpression): expr is NotExpression {
	if (isPrimitiveValue(expr)) {
		return false
	}

	const { neq } = expr as { neq?: PrimitiveValue }
	return neq !== undefined
}

export function isRangeExpression(expr: PrimitiveValue | NotExpression | RangeExpression): expr is RangeExpression {
	if (isPrimitiveValue(expr)) {
		return false
	}

	const { neq } = expr as { neq?: PrimitiveValue }
	return neq === undefined
}
