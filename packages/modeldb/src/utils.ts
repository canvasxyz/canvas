import { signalInvalidType } from "@canvas-js/utils"

import type { Model, ModelValue, Property, PropertyValue } from "./types.js"

export type Awaitable<T> = T | Promise<T>

// eslint-disable-next-line no-useless-escape
export const namePattern = /^[a-zA-Z0-9$:_\-\.]+$/

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
			throw new TypeError(`write to db.${modelName}.${property.name}: expected a string, received a ${typeof value}`)
		}
	} else if (property.kind === "primitive") {
		if (property.optional && value === null) {
			return
		} else if (property.type === "integer") {
			if (typeof value !== "number") {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected an integer, received a ${typeof value}`,
				)
			} else if (!Number.isSafeInteger(value)) {
				throw new TypeError(`write to db.${modelName}.${property.name}: must be a valid Number.isSafeInteger()`)
			}
		} else if (property.type === "number" || property.type === "float") {
			if (typeof value !== "number") {
				throw new TypeError(`write to db.${modelName}.${property.name}: expected a number, received a ${typeof value}`)
			}
		} else if (property.type === "string") {
			if (typeof value !== "string") {
				throw new TypeError(`write to db.${modelName}.${property.name}: expected a string, received a ${typeof value}`)
			}
		} else if (property.type === "bytes") {
			if (value instanceof Uint8Array) {
				return
			} else {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected a Uint8Array, received a ${typeof value}`,
				)
			}
		} else if (property.type === "boolean") {
			if (typeof value !== "boolean") {
				throw new TypeError(`write to db.${modelName}.${property.name}: expected a boolean, received a ${typeof value}`)
			}
		} else if (property.type === "json") {
			if (value === null) {
				throw new TypeError(`write to db.${modelName}.${property.name}: must not be null`)
			}

			// TODO: validate IPLD value

			// try {
			// 	json.encode(value)
			// } catch (e) {
			// 	throw new TypeError(`write to db.${modelName}.${property.name}: expected an IPLD-encodable value`)
			// }
		} else {
			signalInvalidType(property.type)
		}
	} else if (property.kind === "reference") {
		if (property.optional && value === null) {
			return
		} else if (typeof value !== "string") {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected a string, received a ${typeof value}`)
		}
	} else if (property.kind === "relation") {
		if (!Array.isArray(value)) {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected an array of strings, not an array`)
		} else if (value.some((value) => typeof value !== "string")) {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected an array of strings`)
		}
	} else {
		signalInvalidType(property)
	}
}
