import type { Model, ModelValue, Property, PropertyValue } from "./types.js"

export type Awaitable<T> = T | Promise<T>

export const namePattern = /^[a-zA-Z0-9$:_\-\.]+$/

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

export function validateModelValue(model: Model, value: ModelValue) {
	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`missing property ${property.name}`)
		}
		validatePropertyValue(model.name, property, propertyValue)
	}
}

export function validatePropertyValue(modelName: string, property: Property, value: PropertyValue) {
	if (property.kind === "primary") {
		if (typeof value !== "string") {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (property.kind === "primitive") {
		if (property.optional && value === null) {
			return
		} else if (property.type === "integer") {
			if (typeof value !== "number" || !Number.isSafeInteger(value)) {
				throw new TypeError(`${modelName}/${property.name} must be an integer`)
			}
		} else if (property.type === "float") {
			if (typeof value !== "number") {
				throw new TypeError(`${modelName}/${property.name} must be a number`)
			}
		} else if (property.type === "string") {
			if (typeof value !== "string") {
				throw new TypeError(`${modelName}/${property.name} must be a string`)
			}
		} else if (property.type === "bytes") {
			if (value instanceof Uint8Array) {
				return
			} else {
				throw new TypeError(`${modelName}/${property.name} must be a Uint8Array`)
			}
		} else {
			signalInvalidType(property.type)
		}
	} else if (property.kind === "reference") {
		if (property.optional && value === null) {
			return
		} else if (typeof value !== "string") {
			throw new TypeError(`${modelName}/${property.name} must be a string`)
		}
	} else if (property.kind === "relation") {
		if (!Array.isArray(value) || value.some((value) => typeof value !== "string")) {
			throw new TypeError(`${modelName}/${property.name} must be an array of strings`)
		}
	} else {
		signalInvalidType(property)
	}
}

// export const defaultResolver: Resolver = {
// 	lessThan({ version: a }, { version: b }) {
// 		if (b === null) {
// 			return false
// 		} else if (a === null) {
// 			return true
// 		}

// 		let x = a.length
// 		let y = b.length
// 		for (let i = 0, len = Math.min(x, y); i < len; ++i) {
// 			if (a[i] !== b[i]) {
// 				x = a[i]
// 				y = b[i]
// 				break
// 			}
// 		}
// 		return x < y
// 	},
// }
