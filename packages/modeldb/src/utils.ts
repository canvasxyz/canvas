import { assert, signalInvalidType } from "@canvas-js/utils"

import type { Model, ModelValue, Property, PropertyValue } from "./types.js"

export type Awaitable<T> = T | Promise<T>

// eslint-disable-next-line no-useless-escape
export const namePattern = /^[a-zA-Z0-9$:_\-\.]+$/

export const mapValuesAsync = async <K extends string, S, T>(object: Record<K, S>, map: (value: S) => Promise<T>) => {
	const values = await Promise.all(Object.values<S>(object).map((value) => map(value)))
	return Object.fromEntries(zip(Object.keys(object), values))
}

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
		} else if (property.type === "boolean") {
			if (typeof value !== "boolean") {
				throw new TypeError(`${modelName}/${property.name} must be a boolean`)
			}
		} else if (property.type === "json") {
			if (value === null) {
				throw new TypeError(`${modelName}/${property.name} must not be null`)
			}
			try {
				JSON.stringify(value)
			} catch (e) {
				throw new TypeError(`${modelName}/${property.name} must be JSON-serializable`)
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
