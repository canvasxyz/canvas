/**
 * A `ModelType` is a value-level representation of a model field type.
 * used as the TypeScript type for model field *types*.
 */
export type ModelType = "boolean" | "string" | "integer" | "float" | "datetime"

/**
 * A `ModelValue` is a type-level representation of a model field types,
 * used as the TypeScript type for model field *values*.
 */
export type ModelValue = null | boolean | number | string

/**
 * An `Index` defines a list of database indexes to be generated and maintained for a model.
 */
export type Index = string | string[]

/**
 * A `Model` is a map of property names to `ModelType` types.
 * All models must have `id: "string"` and `updated_at: "datetime"` properties.
 */
export type Model = {
	id: "string"
	updated_at: "datetime"
	indexes?: Index[]
} & Record<string, ModelType>
