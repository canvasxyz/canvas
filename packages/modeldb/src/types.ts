// These are "init types" for the `models` value used to initialize the database.

import type { JSONValue } from "@canvas-js/utils"
import type { Awaitable } from "./utils.js"

export type PrimaryKeyType = "primary"
export type PrimitiveType = "integer" | "float" | "number" | "string" | "bytes" | "boolean" | "json"
export type NullablePrimitiveType = `${PrimitiveType}?`
export type ReferenceType = `@${string}`
export type NullableReferenceType = `@${string}?`
export type RelationType = `@${string}[]`
export type YjsDocType = "yjs-doc"

export type PropertyType =
	| PrimaryKeyType
	| PrimitiveType
	| NullablePrimitiveType
	| ReferenceType
	| NullableReferenceType
	| RelationType
	| YjsDocType

/** property name, or property names joined by slashes */
export type IndexInit = string
export type ModelInit = { $indexes?: IndexInit[]; $primary?: string } | Record<string, PropertyType>
export type ModelSchema = Record<string, ModelInit>

// These are more structured representations of the schema defined by ModelSchema that are easier
// to work with at runtime

export type PrimitiveProperty = { name: string; kind: "primitive"; type: PrimitiveType; nullable: boolean }
export type ReferenceProperty = { name: string; kind: "reference"; target: string; nullable: boolean }
export type RelationProperty = { name: string; kind: "relation"; target: string }
export type Property = PrimitiveProperty | ReferenceProperty | RelationProperty

// one-to-many relations have a source model and a target model.
// one-to-many relation sources are always indexed, but targets are only indexed
// if the relation property appears in the $indexes array.

export type Relation = {
	source: string
	sourceProperty: string
	target: string
	indexed: boolean
}

export type Model = {
	name: string
	primaryKey: string[]
	properties: Property[]
	indexes: string[][]
}

// These are types for the runtime model record values

export type PrimaryKeyValue = number | string | Uint8Array
// export type PrimaryKeyArray = PrimaryKeyValue[]

export type PrimitiveValue = number | string | Uint8Array | null | boolean
export type ReferenceValue = PrimaryKeyValue | PrimaryKeyValue[] | null
export type RelationValue = PrimaryKeyValue[] | PrimaryKeyValue[][]

export type PropertyValue = PrimitiveValue | ReferenceValue | RelationValue | JSONValue

export type ModelValue<T = PropertyValue> = { [key: string]: T }
export type ModelValueWithIncludes<T = PropertyValue> = {
	[key: string]: T | ModelValueWithIncludes<T> | ModelValueWithIncludes<T>[]
}

export type WhereCondition = Record<string, PropertyValue | NotExpression | RangeExpression | undefined>
export type NotExpression = { neq: PropertyValue | undefined }
export type RangeExpression = {
	gt?: PrimitiveValue | ReferenceValue
	gte?: PrimitiveValue | ReferenceValue
	lt?: PrimitiveValue | ReferenceValue
	lte?: PrimitiveValue | ReferenceValue
}

export type IncludeExpression = { [key: string]: IncludeExpression }

export type QueryParams = {
	select?: Record<string, boolean>
	include?: IncludeExpression // TODO: only supported on modeldb-idb right now
	where?: WhereCondition
	orderBy?: Record<string, "asc" | "desc">
	limit?: number
	offset?: number
}

// Derives typed PropertyValue = PrimitiveValue | ReferenceValue | RelationValue | JSONValue
// from a given PropertyType

export type DerivePropertyType<T extends PropertyType> = T extends "primary"
	? string
	: T extends "integer" | "float" | "number"
	? number
	: T extends "integer?" | "float?" | "number?"
	? number | null
	: T extends "string"
	? string
	: T extends "string?"
	? string | null
	: T extends "bytes"
	? Uint8Array
	: T extends "bytes?"
	? Uint8Array | null
	: T extends "boolean"
	? boolean
	: T extends "boolean?"
	? boolean | null
	: T extends "json"
	? JSONValue
	: T extends `@${string}[]`
	? RelationValue
	: T extends `@${string}?`
	? ReferenceValue | null
	: T extends `@${string}`
	? ReferenceValue
	: never

export type DeriveModelTypes<T extends ModelSchema> = {
	[K in keyof T as Exclude<K, "$indexes" | "$primary">]: {
		[P in keyof T[K] as Exclude<P, "$indexes" | "$primary">]: T[K][P] extends PropertyType
			? DerivePropertyType<T[K][P]>
			: never
	}
}

export type DeriveModelType<T extends { $indexes?: IndexInit[] } | Record<string, PropertyType>> = {
	[P in keyof T as Exclude<P, "$indexes" | "$primary">]: T[P] extends PropertyType ? DerivePropertyType<T[P]> : never
}

export type Contract<T extends ModelSchema = ModelSchema> = {
	models: T
	actions: Record<string, DeriveModelTypes<T>>
}

// Batch effect API

export type Effect =
	| { model: string; operation: "set"; value: ModelValue<any> }
	| { model: string; operation: "delete"; key: PrimaryKeyValue | PrimaryKeyValue[] }

export interface PropertyEncoder<T> {
	encodePrimitiveValue(propertyName: string, type: PrimitiveType, nullable: boolean, value: PropertyValue): T
	encodeReferenceValue(propertyName: string, target: PrimitiveProperty[], nullable: boolean, value: PropertyValue): T[]
}

export interface PropertyDecoder<T> {
	decodePrimitiveValue(propertyName: string, type: PrimitiveType, nullable: boolean, value: T): PrimitiveValue
	decodeReferenceValue(
		propertyName: string,
		nullable: boolean,
		target: PrimitiveProperty[],
		values: T[],
	): ReferenceValue
}

export interface PropertyAPI<T> {
	columns: string[]
	encode: (value: PropertyValue) => T[]
	decode: (record: Record<string, T>) => PropertyValue
}

export interface DatabaseAPI {
	get<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue | PrimaryKeyValue[],
	): Awaitable<T | null>
	getAll<T extends ModelValue<any> = ModelValue<any>>(modelName: string): Awaitable<T[]>
	getMany<T extends ModelValue<any> = ModelValue<any>>(
		modelName: string,
		key: PrimaryKeyValue[] | PrimaryKeyValue[][],
	): Awaitable<(T | null)[]>
	iterate<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): AsyncIterable<T>
	query<T extends ModelValue<any> = ModelValue<any>>(modelName: string, query?: QueryParams): Awaitable<T[]>
	count(modelName: string, where?: WhereCondition): Awaitable<number>
	clear(modelName: string): Awaitable<void>
	apply(effects: Effect[]): Awaitable<void>
	set<T extends ModelValue<any> = ModelValue<any>>(modelName: string, value: T): Awaitable<void>
	delete(modelName: string, key: PrimaryKeyValue | PrimaryKeyValue[]): Awaitable<void>
}

export interface DatabaseUpgradeAPI extends DatabaseAPI {
	createModel(name: string, init: ModelInit): Awaitable<void>
	deleteModel(name: string): Awaitable<void>

	addProperty(modelName: string, propertyName: string, propertyType: PropertyType): Awaitable<void>
	removeProperty(modelName: string, propertyName: string): Awaitable<void>

	addIndex(modelName: string, index: string): Awaitable<void>
	removeIndex(modelName: string, index: string): Awaitable<void>
}
