import { equals } from "uint8arrays"

import { assert, signalInvalidType, zip } from "@canvas-js/utils"

import {
	Model,
	ModelValue,
	NotExpression,
	PrimitiveProperty,
	PrimitiveType,
	PropertyValue,
	RangeExpression,
	ReferenceProperty,
	RelationProperty,
	WhereCondition,
} from "./types.js"

import { isPrimaryKey, validatePropertyValue } from "./utils.js"

export function lessThan(a: Uint8Array | null, b: Uint8Array | null) {
	if (a === null || b === null) {
		return b !== null
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

export function isLiteralExpression(expr: PropertyValue | NotExpression | RangeExpression): expr is PropertyValue {
	if (expr === null) {
		return true
	} else if (typeof expr === "boolean" || typeof expr === "number" || typeof expr === "string") {
		return true
	} else if (expr instanceof Uint8Array) {
		return true
	} else if (Array.isArray(expr)) {
		return true
	} else {
		return false
	}
}

export function isNotExpression(expr: PropertyValue | NotExpression | RangeExpression): expr is NotExpression {
	if (isLiteralExpression(expr)) {
		return false
	}

	return "neq" in expr
}

export function isRangeExpression(expr: PropertyValue | NotExpression | RangeExpression): expr is RangeExpression {
	if (isLiteralExpression(expr)) {
		return false
	} else if ("neq" in expr) {
		return false
	} else {
		return true
	}
}

interface Order {
	lessThan: (a: PropertyValue, b: PropertyValue) => boolean
	equals: (a: PropertyValue, b: PropertyValue) => boolean
}

// TODO: strings in JavaScript are utf-16, not utf-8,
// and are compared unit-by-unit in utf-16 code units.
// this means strings containing surrogate pairs won't
// sort the same as they would if encoded as utf-8.
const stringOrder: Order = {
	equals: (a, b) => a === b,
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else {
			return a < b
		}
	},
}

const numberOrder: Order = {
	equals: (a, b) => a === b,
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else {
			return a < b
		}
	},
}

const byteOrder: Order = {
	equals: (a, b) => {
		if (a === null && b === null) {
			return true
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return equals(a, b)
		} else {
			return false
		}
	},
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else if (a instanceof Uint8Array && b instanceof Uint8Array) {
			return lessThan(a, b)
		} else {
			return false
		}
	},
}

const booleanOrder: Order = {
	equals: (a, b) => {
		if (a === null && b === null) {
			return true
		} else if (typeof a === "boolean" && typeof b === "boolean") {
			return a === b
		} else {
			return false
		}
	},
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		} else if (typeof a === "boolean" && typeof b === "boolean") {
			return a === false && b === true
		} else {
			return false
		}
	},
}

export const primitiveTypeOrders: Record<PrimitiveType, Order> = {
	integer: numberOrder,
	float: numberOrder,
	number: numberOrder,
	string: stringOrder,
	bytes: byteOrder,
	boolean: booleanOrder,
	json: stringOrder,
}

export const referenceOrder: Order = {
	equals: (a, b) => {
		if (a === null && b === null) {
			return true
		}

		const wrappedA = Array.isArray(a) ? a : [a]
		const wrappedB = Array.isArray(b) ? b : [b]
		assert(wrappedA.length === wrappedB.length)

		return Array.from(zip(wrappedA, wrappedB)).every(([keyA, keyB]) => {
			if (typeof keyA === "number" && typeof keyB === "number") {
				return keyA === keyB
			} else if (typeof keyA === "string" && typeof keyB === "string") {
				return keyA === keyB
			} else if (keyA instanceof Uint8Array && keyB instanceof Uint8Array) {
				return equals(keyA, keyB)
			} else {
				throw new Error("internal error - incomparable primary keys")
			}
		})
	},
	lessThan: (a, b) => {
		if (a === null && b === null) {
			return false
		} else if (a === null) {
			return true
		} else if (b === null) {
			return false
		}

		const wrappedA = Array.isArray(a) ? a : [a]
		const wrappedB = Array.isArray(b) ? b : [b]
		assert(wrappedA.length === wrappedB.length)

		for (const [keyA, keyB] of zip(wrappedA, wrappedB)) {
			if (typeof keyA === "number" && typeof keyB === "number") {
				if (keyA < keyB) {
					return true
				} else if (keyA === keyB) {
					continue
				} else {
					return false
				}
			} else if (typeof keyA === "string" && typeof keyB === "string") {
				if (keyA < keyB) {
					return true
				} else if (keyA === keyB) {
					continue
				} else {
					return false
				}
			} else if (keyA instanceof Uint8Array && keyB instanceof Uint8Array) {
				if (lessThan(keyA, keyB)) {
					return true
				} else if (equals(keyA, keyB)) {
					continue
				} else {
					return false
				}
			} else {
				throw new Error("internal error - incomparable primary keys")
			}
		}

		if (typeof a === "boolean" && typeof b === "boolean") {
			return a === false && b === true
		} else {
			return false
		}
	},
}

export function getCompare(
	model: Model,
	orderBy: Record<string, "asc" | "desc">,
): (a: ModelValue, b: ModelValue) => -1 | 0 | 1 {
	const entries = Object.entries(orderBy)
	assert(entries.length === 1, `error comparing ${model.name}: orderBy must have exactly one entry`)
	const [[propertyName, direction]] = entries
	const property = model.properties.find((property) => property.name === propertyName)
	assert(property !== undefined, `error comparing ${model.name}: property not found`)

	if (property.kind === "primitive") {
		const order = primitiveTypeOrders[property.type]
		if (direction === "asc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) => (order.lessThan(a, b) ? -1 : order.equals(a, b) ? 0 : 1)
		} else if (direction === "desc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) => (order.lessThan(a, b) ? 1 : order.equals(a, b) ? 0 : -1)
		} else {
			signalInvalidType(direction)
		}
	} else if (property.kind === "reference") {
		if (direction === "asc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) =>
				referenceOrder.lessThan(a, b) ? -1 : referenceOrder.equals(a, b) ? 0 : 1
		} else if (direction === "desc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) =>
				referenceOrder.lessThan(a, b) ? 1 : referenceOrder.equals(a, b) ? 0 : -1
		} else {
			signalInvalidType(direction)
		}
	} else if (property.kind === "relation") {
		throw new Error(`error comparing ${model.name}: cannot orderBy a relation property`)
	} else {
		signalInvalidType(property)
	}
}

export function getFilter(model: Model, where: WhereCondition = {}): (value: ModelValue) => boolean {
	const filters: { property: string; filter: (value: PropertyValue) => boolean }[] = []
	for (const [propertyName, expression] of Object.entries(where)) {
		if (expression === undefined) {
			continue
		}

		if (Array.isArray(expression) && expression.every((value) => value === undefined)) {
			continue
		}

		const filter = getPropertyFilter(model, propertyName, expression)
		filters.push({ property: propertyName, filter })
	}

	return (value) => filters.every(({ filter, property }) => filter(value[property]))
}

function getPropertyFilter(
	model: Model,
	propertyName: string,
	expression: PropertyValue | NotExpression | RangeExpression,
): (value: PropertyValue) => boolean {
	const property = model.properties.find((property) => property.name === propertyName)
	assert(property !== undefined, `error filtering ${model.name}.${propertyName}: property not found`)

	if (property.kind === "primitive") {
		assert(property.type !== "json", "cannot query json values")
		return getPrimitiveFilter(model.name, property, expression)
	} else if (property.kind === "reference") {
		return getReferenceFilter(model.name, property, expression)
	} else if (property.kind === "relation") {
		return getRelationFilter(model.name, property, expression)
	} else {
		signalInvalidType(property)
	}
}

function getReferenceFilter(
	modelName: string,
	property: ReferenceProperty,
	expression: PropertyValue | NotExpression | RangeExpression,
): (value: PropertyValue) => boolean {
	if (isLiteralExpression(expression)) {
		return (value) => referenceOrder.equals(value, expression)
	} else if (isNotExpression(expression)) {
		return (value) => expression.neq === undefined || !referenceOrder.equals(value, expression.neq)
	} else if (isRangeExpression(expression)) {
		// TODO: support range expressions over references
		throw new Error(`error filtering ${modelName}.${property.name}: cannot use range expressions on reference values`)
	} else {
		signalInvalidType(expression)
	}
}

function getRelationFilter(
	modelName: string,
	property: RelationProperty,
	expression: PropertyValue | NotExpression | RangeExpression,
): (value: PropertyValue) => boolean {
	if (isLiteralExpression(expression)) {
		const reference = expression
		if (!Array.isArray(reference)) {
			throw new Error(
				`error filtering ${modelName}.${property.name}: invalid relation expression - expected array of primary keys`,
			)
		} else if (!reference.every((key) => isPrimaryKey(key) || (Array.isArray(key) && key.every(isPrimaryKey)))) {
			throw new Error(
				`error filtering ${modelName}.${property.name}: invalid relation expression - expected array of primary keys`,
			)
		}

		return (value) => {
			assert(Array.isArray(value), "expected array of primary keys to match")
			return reference.every((target) => value.some((key) => referenceOrder.equals(key, target)))
		}
	} else if (isNotExpression(expression)) {
		const reference = expression.neq
		if (!Array.isArray(reference)) {
			throw new Error(
				`error filtering ${modelName}.${property.name}: invalid relation expression - expected array of primary keys`,
			)
		} else if (!reference.every((key) => isPrimaryKey(key) || (Array.isArray(key) && key.every(isPrimaryKey)))) {
			throw new Error(
				`error filtering ${modelName}.${property.name}: invalid relation expression - expected array of primary keys`,
			)
		}

		return (value) => {
			assert(Array.isArray(value), "expected array of primary keys to match")
			return reference.every((target) => value.every((key) => !referenceOrder.equals(key, target)))
		}
	} else if (isRangeExpression(expression)) {
		throw new Error(`error filtering ${modelName}.${property.name}: cannot use range expressions on relation values`)
	} else {
		signalInvalidType(expression)
	}
}

function getPrimitiveFilter(
	modelName: string,
	property: PrimitiveProperty,
	expression: PropertyValue | NotExpression | RangeExpression,
): (value: PropertyValue) => boolean {
	const order = primitiveTypeOrders[property.type]

	if (isLiteralExpression(expression)) {
		const reference = expression
		validatePropertyValue(modelName, property, reference)
		return (value) => order.equals(value, reference)
	} else if (isNotExpression(expression)) {
		const reference = expression.neq
		if (reference === undefined) {
			return (value) => true
		} else {
			validatePropertyValue(modelName, property, reference)
			return (value) => !order.equals(value, reference)
		}
	} else if (isRangeExpression(expression)) {
		const { gt, gte, lt, lte } = expression
		for (const value of [gt, gte, lt, lte]) {
			if (value !== undefined) {
				validatePropertyValue(modelName, property, value)
			}
		}

		return (value) => {
			if (gt !== undefined) {
				if (order.lessThan(value, gt) || order.equals(value, gt)) {
					return false
				}
			}

			if (gte !== undefined) {
				if (order.lessThan(value, gte)) {
					return false
				}
			}

			if (lt !== undefined) {
				if (!order.lessThan(value, lt)) {
					return false
				}
			}

			if (lte !== undefined) {
				if (!order.lessThan(value, lte) && !order.equals(value, lte)) {
					return false
				}
			}

			return true
		}
	} else {
		signalInvalidType(expression)
	}
}
