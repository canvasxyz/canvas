import { signalInvalidType, merge, update, JSONValue, assert } from "@canvas-js/utils"

import type {
	IncludeExpression,
	Model,
	ModelSchema,
	ModelValue,
	PrimaryKeyValue,
	PrimitiveProperty,
	PrimitiveValue,
	Property,
	PropertyValue,
	ReferenceValue,
	RelationValue,
} from "./types.js"

export type Awaitable<T> = T | Promise<T>

export const isPrimaryKey = (value: unknown): value is PrimaryKeyValue => {
	if (typeof value === "number") {
		return Number.isSafeInteger(value)
	} else if (typeof value === "string") {
		return true
	} else if (value instanceof Uint8Array) {
		return true
	} else {
		return false
	}
}

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

export function isPrimitiveValue(value: unknown): value is PrimitiveValue {
	return (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string" ||
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

const formatValue = (value: PropertyValue) => {
	let valueFormat
	if (value === null) {
		valueFormat = "null"
	} else if (value === undefined) {
		valueFormat = "undefined"
	} else if (typeof value !== "object") {
		valueFormat = value.toString()
	} else {
		try {
			valueFormat = JSON.stringify(value)
		} catch (err) {
			valueFormat = value.toString()
		}
	}
	return `${typeof value}: ${valueFormat}`
}

export function validatePropertyValue(modelName: string, property: Property, value: PropertyValue) {
	if (property.kind === "primitive") {
		if (property.nullable && value === null) {
			return
		} else if (property.type === "integer") {
			if (typeof value !== "number") {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected an integer, received ${formatValue(value)}`,
				)
			} else if (!Number.isSafeInteger(value)) {
				throw new TypeError(`write to db.${modelName}.${property.name}: must be a valid Number.isSafeInteger()`)
			}
		} else if (property.type === "number" || property.type === "float") {
			if (typeof value !== "number") {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected a number, received ${formatValue(value)}`,
				)
			}
		} else if (property.type === "string") {
			if (typeof value !== "string") {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected a string, received ${formatValue(value)}`,
				)
			}
		} else if (property.type === "bytes") {
			if (value instanceof Uint8Array) {
				return
			} else {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected a Uint8Array, received ${formatValue(value)}`,
				)
			}
		} else if (property.type === "boolean") {
			if (typeof value !== "boolean") {
				throw new TypeError(
					`write to db.${modelName}.${property.name}: expected a boolean, received ${formatValue(value)}`,
				)
			}
		} else if (property.type === "json") {
			// TODO: validate IPLD value
		} else {
			signalInvalidType(property.type)
		}
	} else if (property.kind === "reference") {
		if (property.nullable && value === null) {
			return
		} else if (!isPrimaryKey(value)) {
			throw new TypeError(
				`write to db.${modelName}.${property.name}: expected a primary key, received ${formatValue(value)}`,
			)
		}
	} else if (property.kind === "relation") {
		if (value === null) {
			throw new TypeError(`write to db.${modelName}.${property.name}: expected an array of primary keys, not null`)
		} else if (!Array.isArray(value)) {
			throw new TypeError(
				`write to db.${modelName}.${property.name}: expected an array of primary keys, received ${formatValue(value)}`,
			)
		} else if (!value.every(isPrimaryKey)) {
			throw new TypeError(
				`write to db.${modelName}.${property.name}: expected an array of primary keys, received ${formatValue(value)}`,
			)
		}
	} else {
		signalInvalidType(property)
	}
}
