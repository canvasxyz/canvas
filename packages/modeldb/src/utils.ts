import { signalInvalidType, merge, update, JSONValue, assert } from "@canvas-js/utils"

import type {
	IncludeExpression,
	Model,
	ModelSchema,
	ModelValue,
	PrimaryKeyValue,
	PrimitiveValue,
	Property,
	PropertyValue,
	ReferenceValue,
	RelationValue,
} from "./types.js"

export type Awaitable<T> = T | Promise<T>

// eslint-disable-next-line no-useless-escape
export const namePattern = /^[a-zA-Z0-9$:_\-\.]+$/

export function updateModelValues(from: ModelValue | undefined, into: ModelValue | undefined): ModelValue {
	return update(from, into) as ModelValue
}

export function mergeModelValues(from: ModelValue | undefined, into: ModelValue | undefined): ModelValue {
	return merge(from, into) as ModelValue
}

export function* getModelsFromInclude(models: Model[], modelName: string, obj: IncludeExpression): Generator<string> {
	const model = models.find((model) => model.name === modelName)
	// this should never happen because modelName is taken from the outside ModelAPI
	assert(model !== undefined, `include expression used a nonexistent model`)

	for (const key of Object.keys(obj)) {
		const prop = model.properties.find((prop) => prop.name === key)
		assert(
			prop && (prop.kind === "relation" || prop.kind === "reference"),
			`include expression referenced ${modelName}.${key}, which was not a valid relation or reference`,
		)
		yield prop.target

		// recursively found models
		for (const model of getModelsFromInclude(models, prop.target, obj[key])) {
			yield model
		}
	}
}

export function isPrimitiveValue(
	value: PrimaryKeyValue | PrimitiveValue | JSONValue,
): value is PrimaryKeyValue | PrimitiveValue {
	return (
		typeof value === "string" ||
		typeof value === "number" ||
		value === null ||
		typeof value === "boolean" ||
		value instanceof Uint8Array
	)
}

export function validateModelValue(model: Model, value: ModelValue) {
	for (const property of model.properties) {
		const propertyValue = value[property.name]
		if (propertyValue === undefined) {
			throw new Error(`write to db.${model.name}: missing ${property.name}`)
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
		if (property.nullable && value === null) {
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
		if (property.nullable && value === null) {
			return
		} else if (typeof value !== "string") {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected a string, received a ${typeof value}`)
		}
	} else if (property.kind === "relation") {
		if (value === null) {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected an array of strings, not null`)
		} else if (!Array.isArray(value)) {
			throw new TypeError(
				`write to db.${modelName}.${property.name}: expected an array of strings, not a ${typeof value}`,
			)
		} else if (value.some((value) => typeof value !== "string")) {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected an array of strings`)
		}
	} else {
		signalInvalidType(property)
	}
}
