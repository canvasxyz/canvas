import { equals } from "uint8arrays"
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

import { assert, signalInvalidType, validatePropertyValue } from "./utils.js"

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
	} else if (Array.isArray(expr) && expr.every((value) => typeof value === "string")) {
		return true
	} else {
		return false
	}
}

export function isNotExpression(expr: PropertyValue | NotExpression | RangeExpression): expr is NotExpression {
	if (isLiteralExpression(expr)) {
		return false
	}

	const { neq } = expr as { neq?: PropertyValue }
	return neq !== undefined
}

export function isRangeExpression(expr: PropertyValue | NotExpression | RangeExpression): expr is RangeExpression {
	if (isLiteralExpression(expr)) {
		return false
	}

	const { neq } = expr as { neq?: PropertyValue }
	return neq === undefined
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

export const primitiveTypeOrders: Record<PrimitiveType, Order> = {
	integer: numberOrder,
	float: numberOrder,
	string: stringOrder,
	bytes: byteOrder,
}

export const referenceOrder = stringOrder

export function getCompare(
	model: Model,
	orderBy: Record<string, "asc" | "desc">,
): (a: ModelValue, b: ModelValue) => -1 | 0 | 1 {
	const entries = Object.entries(orderBy)
	assert(entries.length === 1, "orderBy must have exactly one entry")
	const [[propertyName, direction]] = entries
	const property = model.properties.find((property) => property.name === propertyName)
	assert(property !== undefined, "property not found")

	if (property.kind === "primary") {
		if (direction === "asc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) =>
				stringOrder.lessThan(a, b) ? -1 : stringOrder.equals(a, b) ? 0 : 1
		} else if (direction === "desc") {
			return ({ [propertyName]: a }, { [propertyName]: b }) =>
				stringOrder.lessThan(a, b) ? 1 : stringOrder.equals(a, b) ? 0 : -1
		} else {
			signalInvalidType(direction)
		}
	} else if (property.kind === "primitive") {
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
		throw new Error("cannot orderBy a relation property")
	} else {
		signalInvalidType(property)
	}
}

export function getFilter(model: Model, where: WhereCondition = {}): (value: ModelValue) => boolean {
	const filters: { property: string; filter: (value: PropertyValue) => boolean }[] = []
	for (const [property, expression] of Object.entries(where)) {
		const filter = getPropertyFilter(model, property, expression)
		filters.push({ property, filter })
	}

	return (value) => filters.every(({ filter, property }) => filter(value[property]))
}

function getPropertyFilter(
	model: Model,
	propertyName: string,
	expression: PropertyValue | NotExpression | RangeExpression,
): (value: PropertyValue) => boolean {
	const property = model.properties.find((property) => property.name === propertyName)
	assert(property !== undefined)

	if (property.kind === "primary") {
		return getPrimitiveFilter(
			model.name,
			{ name: propertyName, kind: "primitive", type: "string", optional: false },
			expression,
		)
	} else if (property.kind === "primitive") {
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
		const reference = expression
		assert(reference === null || typeof reference === "string", "invalid reference value expression")
		return (value) => value === reference
	} else if (isNotExpression(expression)) {
		const reference = expression.neq
		assert(reference === null || typeof reference === "string", "invalid reference value expression")
		return (value) => value !== reference
	} else if (isRangeExpression(expression)) {
		// idk there's no real reason not to allow this
		throw new Error("cannot use range expressions on reference values")
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
		assert(
			Array.isArray(reference) && reference.every((value) => typeof value === "string"),
			"invalid relation expression (expected string[])",
		)
		return (value) => reference.every((target) => Array.isArray(value) && value.includes(target))
	} else if (isNotExpression(expression)) {
		const reference = expression.neq
		assert(
			Array.isArray(reference) && reference.every((value) => typeof value === "string"),
			"invalid relation expression (expected string[])",
		)
		return (value) => reference.every((target) => Array.isArray(value) && !value.includes(target))
	} else if (isRangeExpression(expression)) {
		throw new Error("cannot use range expressions on relation values")
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
		validatePropertyValue(modelName, property, reference)
		return (value) => !order.equals(value, reference)
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
