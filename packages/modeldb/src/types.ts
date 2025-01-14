// These are "init types" for the `models` value used to initialize the database.

import { JSONValue } from "@canvas-js/utils"

export type PrimaryKeyType = "primary"
export type PrimitiveType = "integer" | "float" | "number" | "string" | "bytes" | "boolean" | "json"
export type NullablePrimitiveType = `${PrimitiveType}?`
export type ReferenceType = `@${string}`
export type NullableReferenceType = `@${string}?`
export type RelationType = `@${string}[]`

export type PropertyType =
	| PrimaryKeyType
	| PrimitiveType
	| NullablePrimitiveType
	| ReferenceType
	| NullableReferenceType
	| RelationType

export type IndexInit = string | string[]

export type ModelSchema = Record<string, { $indexes?: IndexInit[] } | Record<string, PropertyType>>

// These are more structured representations of the schema defined by ModelSchema that are easier
// to work with at runtime

export type PrimaryKeyProperty = { name: string; kind: "primary" }
export type PrimitiveProperty = { name: string; kind: "primitive"; type: PrimitiveType; nullable: boolean }
export type ReferenceProperty = { name: string; kind: "reference"; target: string; nullable: boolean }
export type RelationProperty = { name: string; kind: "relation"; target: string }
export type Property = PrimaryKeyProperty | PrimitiveProperty | ReferenceProperty | RelationProperty

// one-to-many relations have a source model and a target model.
// one-to-many relation sources are always indexed, but targets are only indexed
// if the relation property appears in the $indexes array.

export type Relation = { source: string; property: string; target: string; indexed: boolean }

export type Model = {
	name: string
	primaryKey: string
	properties: Property[]
	indexes: string[][]
}

export type Config = {
	relations: Relation[]
	models: Model[]
}

// These are types for the runtime model record values

export type PrimaryKeyValue = string
export type PrimitiveValue = number | string | Uint8Array | null | boolean
export type ReferenceValue = string | null
export type RelationValue = string[]

export type PropertyValue = PrimaryKeyValue | PrimitiveValue | ReferenceValue | RelationValue | JSONValue

export type ModelValue<T = PropertyValue> = { [key: string]: T }
export type ModelValueWithIncludes<T = PropertyValue> = {
	[key: string]: T | ModelValueWithIncludes<T> | ModelValueWithIncludes<T>[]
}

export type WhereCondition = Record<string, PropertyValue | NotExpression | RangeExpression | undefined>
export type NotExpression = { neq: PropertyValue | undefined }
export type RangeExpression = { gt?: PrimitiveValue; gte?: PrimitiveValue; lt?: PrimitiveValue; lte?: PrimitiveValue }

export type IncludeExpression = { [key: string]: IncludeExpression }

export type QueryParams = {
	select?: Record<string, boolean>
	include?: IncludeExpression // TODO: only supported on modeldb-idb right now
	where?: WhereCondition
	orderBy?: Record<string, "asc" | "desc">
	limit?: number
	offset?: number
}

// Derives typed PropertyValue = PrimaryKeyValue | PrimitiveValue | ReferenceValue | RelationValue | JSONValue
// from a given PropertyType

export type DerivePropertyType<T extends PropertyType> = T extends "primary"
	? PrimaryKeyValue
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
	[K in keyof T as Exclude<K, "$indexes">]: {
		[P in keyof T[K] as Exclude<P, "$indexes">]: T[K][P] extends PropertyType ? DerivePropertyType<T[K][P]> : never
	}
}

export type DeriveModelType<T extends { $indexes?: IndexInit[] } | Record<string, PropertyType>> = {
	[P in keyof T as Exclude<P, "$indexes">]: T[P] extends PropertyType ? DerivePropertyType<T[P]> : never
}

export type Contract<T extends ModelSchema = ModelSchema> = {
	models: T
	actions: Record<string, DeriveModelTypes<T>>
}

// Batch effect API

export type Effect =
	| { model: string; operation: "set"; value: ModelValue<any> }
	| { model: string; operation: "delete"; key: string }
