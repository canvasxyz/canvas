// These are "init types" for the `models` value used to initialize the database.

export type PrimaryKeyType = "primary"
export type PrimitiveType = "integer" | "float" | "number" | "string" | "bytes" | "boolean" | "json"
export type OptionalPrimitiveType = `${PrimitiveType}?`
export type ReferenceType = `@${string}`
export type OptionalReferenceType = `@${string}?`
export type RelationType = `@${string}[]`

export type PropertyType =
	| PrimaryKeyType
	| PrimitiveType
	| OptionalPrimitiveType
	| ReferenceType
	| OptionalReferenceType
	| RelationType

export type IndexInit = string | string[]

type MergeFunction = (value1: any, value2: any) => any
export type ModelSchema = Record<
	string,
	{ $indexes?: IndexInit[]; $merge?: MergeFunction } & Record<string, PropertyType | IndexInit[] | MergeFunction>
>

// These are more structured representations of the schema defined by ModelSchema that are easier
// to work with at runtime

export type PrimaryKeyProperty = { name: string; kind: "primary" }
export type PrimitiveProperty = { name: string; kind: "primitive"; type: PrimitiveType; optional: boolean }
export type ReferenceProperty = { name: string; kind: "reference"; target: string; optional: boolean }
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
	merge: MergeFunction | undefined
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

export type PropertyValue = PrimaryKeyValue | PrimitiveValue | ReferenceValue | RelationValue

export type ModelValue<T = PropertyValue> = Record<string, T>

export type WhereCondition = Record<string, PropertyValue | NotExpression | RangeExpression>
export type NotExpression = { neq: PropertyValue }
export type RangeExpression = { gt?: PrimitiveValue; gte?: PrimitiveValue; lt?: PrimitiveValue; lte?: PrimitiveValue }

export type QueryParams = {
	select?: Record<string, boolean> // TODO: add support for joining reference/relation values a la primsa
	where?: WhereCondition
	orderBy?: Record<string, "asc" | "desc">
	limit?: number
	offset?: number
}

// Batch effect API

export type Effect =
	| { model: string; operation: "set"; value: ModelValue<any> }
	| { model: string; operation: "delete"; key: string }
