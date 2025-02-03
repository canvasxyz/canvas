import * as json from "@ipld/dag-json"

import { assert, signalInvalidType } from "@canvas-js/utils"

import {
	Property,
	PropertyValue,
	isPrimitiveValue,
	isReferenceValue,
	ReferenceValue,
	RelationValue,
	isRelationValue,
	isPrimaryKey,
} from "@canvas-js/modeldb"

export type IDBPrimitiveValue = number | string | Uint8Array | boolean
export type IDBValue = IDBPrimitiveValue | [] | [IDBPrimitiveValue] | ReferenceValue | RelationValue

export function encodePropertyValue(property: Property, propertyValue: PropertyValue): IDBValue {
	if (property.kind === "primitive") {
		if (property.nullable) {
			assert(property.type !== "json", 'expected property.type !== "json"')
			if (isPrimitiveValue(propertyValue)) {
				return propertyValue === null ? [] : [propertyValue]
			} else {
				throw new TypeError(`${property.name}: expected ${property.type}`)
			}
		} else if (property.type === "json") {
			return json.stringify(propertyValue)
		} else {
			if (propertyValue === null) {
				throw new TypeError(`${property.name} cannot be null`)
			} else if (isPrimitiveValue(propertyValue)) {
				return propertyValue
			} else {
				throw new TypeError(`${property.name}: expected ${property.type}`)
			}
		}
	} else if (property.kind === "reference") {
		if (property.nullable) {
			if (propertyValue === null) {
				return []
			} else if (isReferenceValue(propertyValue)) {
				return Array.isArray(propertyValue) ? propertyValue : [propertyValue]
			} else {
				throw new TypeError(`${property.name}: expected primary key`)
			}
		} else {
			if (propertyValue === null) {
				throw new TypeError(`${property.name} cannot be null`)
			} else if (isReferenceValue(propertyValue)) {
				return propertyValue
			} else {
				throw new TypeError(`${property.name}: expected primary key`)
			}
		}
	} else if (property.kind === "relation") {
		if (isRelationValue(propertyValue)) {
			return propertyValue
		} else {
			throw new TypeError(`${property.name}: expected array of primary keys`)
		}
	} else {
		signalInvalidType(property)
	}
}

export function decodePropertyValue(property: Property, value: IDBValue): PropertyValue {
	if (property.kind === "primitive") {
		if (property.nullable) {
			assert(property.type !== "json", 'expected property.type !== "json"')
			assert(Array.isArray(value), "expected array value")
			const [v = null] = value
			assert(isPrimitiveValue(v), "expected primitive value")
			return v
		} else if (property.type === "json") {
			assert(typeof value === "string", 'expected typeof value === "string"')
			return json.parse(value)
		} else {
			assert(isPrimitiveValue(value), "expected primitive value")
			assert(value !== null, "expected value !== null")
			return value
		}
	} else if (property.kind === "reference") {
		if (property.nullable) {
			assert(Array.isArray(value), "expected Array.isArray(value)")
			if (value.length === 0) {
				return null
			} else if (value.length === 1) {
				assert(isPrimaryKey(value[0]), "expected primary key value")
				return value[0]
			} else {
				assert(value.every(isPrimaryKey), "expeected primary key value")
				return value
			}
		} else {
			if (Array.isArray(value)) {
				assert(value.length > 0, "value cannot be null")
				assert(value.length > 1, "invalid primary key value")
				assert(value.every(isPrimaryKey), "expected primary key value")
				return value
			} else {
				assert(isPrimaryKey(value), "expected primary key value")
				return value
			}
		}
	} else if (property.kind === "relation") {
		assert(isRelationValue(value), "expected array of primary keys")
		return value
	} else {
		signalInvalidType(property)
	}
}
