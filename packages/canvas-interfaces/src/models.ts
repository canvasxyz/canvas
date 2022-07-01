/**
 * A `ModelType` is a runtime representation of an abstract model field type,
 * ie string values that we use to set the sqlite schema and coerce
 * action arguments.
 */
export type ModelType = "boolean" | "string" | "integer" | "float" | "datetime"

/**
 * An `IndexType` defines a list of indexes to be generated and maintained for a model.
 */
export type IndexType = string[]

/**
 * A `ModelValue` is a type-level representation of concrete model field types, ie
 * a TypeScript type that describes the possible JavaScript values that instantiate
 * the various ModelType options.
 */
export type ModelValue = null | boolean | number | string

/**
 * A `Model` is a map of property names to `ModelType` types
 */
export type Model = Record<string, ModelType> & { indexes?: IndexType }
