// These are "init types" for the `models` value used to initialize the database.

export type PrimitiveType = "integer" | "float" | "string" | "bytes"
export type OptionalPrimitiveType = `${PrimitiveType}?`
export type ReferenceType = `@${string}`
export type OptionalReferenceType = `@${string}?`
export type RelationType = `@${string}[]`

export type PropertyType = PrimitiveType | OptionalPrimitiveType | ReferenceType | OptionalReferenceType | RelationType

export type IndexInit = string | string[]

export type ModelsInit = Record<
	string,
	{ $type?: "mutable" | "immutable"; $indexes?: IndexInit[] } & Record<string, PropertyType>
>

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
	kind: "mutable" | "immutable"
	properties: Property[]
	indexes: string[][]
}

export type Config = {
	relations: Relation[]
	models: Model[]
}

// These are types for the runtime model record values

export type PrimitiveValue = boolean | number | string | Uint8Array | null
export type ReferenceValue = string | null
export type RelationValue = string[]

export type PropertyValue = PrimitiveValue | ReferenceValue | RelationValue

export type ModelValue = Record<string, PropertyValue>

export type QueryParams = {}

// Types for the ModelDB internal API

export type RecordValue = Record<string, string | number | Buffer | null>

export type TombstoneAPI = {
	select: (params: { _key: string }) => Promise<{ _metadata: string | null; _version: string } | null>
	delete: (params: { _key: string }) => Promise<void>
	insert: (params: { _key: string; _metadata: string | null; _version: string }) => Promise<void>
	update: (params: { _key: string; _metadata: string | null; _version: string }) => Promise<void>
}

export type RelationAPI = {
	// should this be AsyncIterable?
	selectAll: (params: { _source: string }) => Promise<{ _target: string }[]>
	deleteAll: (params: { _source: string }) => Promise<void>
	create: (params: { _source: string; _target: string }) => Promise<void>
}

export type MutableRecordAPI = {
	params?: Record<string, string>
	selectVersion: (params: { _key: string }) => Promise<{ _version: string | null } | null>
	iterate: (params: {}) => AsyncIterable<ModelValue>
	select: (params: { _key: string }) => Promise<ModelValue | null>
	selectAll: (params: {}) => Promise<ModelValue[]>
	insert: (params: {
		_key: string
		_version: string | null
		_metadata: string | null
		value: ModelValue
	}) => Promise<void>
	update: (params: {
		_key: string
		_version: string | null
		_metadata: string | null
		value: ModelValue
	}) => Promise<void>
	delete: (params: { _key: string }) => Promise<void>
	query: (params: QueryParams) => Promise<ModelValue[]>
}

export type ImmutableRecordAPI = {
	params?: Record<string, string>
	iterate: (params: {}) => AsyncIterable<ModelValue>
	select: (params: { _key: string }) => Promise<ModelValue | null>
	selectAll: (params: {}) => Promise<ModelValue[]>
	insert: (params: { _key: string; _metadata: string | null; value: ModelValue }) => Promise<void>
	update: (params: {
		_key: string
		_metadata: string | null
		_version: string | null
		value: ModelValue
	}) => Promise<void>
	delete: (params: { _key: string }) => Promise<void>
	query: (params: QueryParams) => Promise<ModelValue[]>
}
