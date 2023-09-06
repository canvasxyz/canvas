// These are "init types" for the `models` value used to initialize the database.

export type PrimitiveType = "integer" | "float" | "string" | "bytes"
export type OptionalPrimitiveType = `${PrimitiveType}?`
export type ReferenceType = `@${string}`
export type OptionalReferenceType = `@${string}?`
export type RelationType = `@${string}[]`

export type PropertyType = PrimitiveType | OptionalPrimitiveType | ReferenceType | OptionalReferenceType | RelationType

export type IndexInit = string | string[]

export type ModelsInit = Record<string, { $indexes?: IndexInit[] } & Record<string, PropertyType | IndexInit[]>>

// These are more structured representations of the schema defined by ModelsInit that are easier
// to work with at runtime

export type PrimitiveProperty = { name: string; kind: "primitive"; type: PrimitiveType; optional: boolean }
export type ReferenceProperty = { name: string; kind: "reference"; target: string; optional: boolean }
export type RelationProperty = { name: string; kind: "relation"; target: string }
export type Property = PrimitiveProperty | ReferenceProperty | RelationProperty

// one-to-many relations have a source model and a target model.
// one-to-many relation sources are always indexed, but targets are only indexed
// if the relation property appears in the $indexes array.

export type Relation = { source: string; property: string; target: string; indexed: boolean }

export type Model = {
	name: string
	properties: Property[]
	indexes: string[][]
}

export type Config = {
	relations: Relation[]
	models: Model[]
}

/**
 * /data/[username]/[slug]/v0
 * /data/[username]/[slug]/v1
 * 
 * /data/[username]/[slug]/v2/contract.canvas.js
 * /data/[username]/[slug]/v2/modeldb.sqlite
 * /data/[username]/[slug]/v2/com.example.app/*
 * /data/[username]/[slug]/v2/com.example.fjs/*
 
 * /data/[username]/[slug]/v3/contract.canvas.js
 * /data/[username]/[slug]/v3/messages/com.example.app/*
 * /data/[username]/[slug]/v3/messages/com.example.fjs/*
 * 
 *
 *
 *
 */

// These are types for the runtime model record values

export type PrimitiveValue = number | string | Uint8Array | null
export type ReferenceValue = string | null
export type RelationValue = string[]

export type PropertyValue = PrimitiveValue | ReferenceValue | RelationValue

export type ModelValue = Record<string, PropertyValue>

export type WhereCondition = Record<string, PrimitiveValue | NotExpression | RangeExpression>
export type NotExpression = { neq: PrimitiveValue }
export type RangeExpression = { gt?: PrimitiveValue; gte?: PrimitiveValue; lt?: PrimitiveValue; lte?: PrimitiveValue }

export type QueryParams = {
	select?: Record<string, boolean> // TODO: add support for joining reference/relation values a la primsa
	where?: WhereCondition
	orderBy?: Record<string, "asc" | "desc">
	limit?: number
}

// Batch effect API

export type Effect =
	| { model: string; operation: "set"; key: string; value: ModelValue }
	| { model: string; operation: "delete"; key: string }

// Conflict resolver

export type Context = { version: Uint8Array | null }

export type Resolver = {
	lessThan(a: Context, b: Context): boolean
}
