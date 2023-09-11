import { base58btc } from "multiformats/bases/base58"

import { getCID } from "@canvas-js/signed-cid"

import type { Context, Model, ModelValue, Property, PropertyValue, Resolver } from "./types.js"

// TODO: ????
// export const nsidPattern = /^[a-z](?:-*[a-z0-9])*(?:\.[a-z](?:-*[a-z0-9])*)*$/

export type Awaitable<T> = T | Promise<T>

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? `assertion failed`)
	}
}

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (entry: [key: K, value: S]) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map([key as K, value])])) as Record<K, T>

export const mapKeys = <K extends string, S, T>(object: Record<K, S>, map: (key: K) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K)])) as Record<K, T>

export const mapValues = <K extends string, S, T>(object: Record<K, S>, map: (value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(value)])) as Record<K, T>

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
	assert(a.length === b.length, "cannot zip arrays of different sizes")
	const result = new Array(a.length)
	for (let i = 0; i < a.length; i++) {
		result[i] = [a[i], b[i]]
	}

	return result
}

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

export const defaultResolver: Resolver = { lessThan: lessThanVersion }

// TODO: make absolutely sure this does what we want
function lessThanVersion({ version: a }: Context, { version: b }: Context) {
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
