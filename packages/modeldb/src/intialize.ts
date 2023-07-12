import { Property, Relation, Model } from "./types.js"
import { signalInvalidType } from "./utils.js"

export const getRecordTableName = (modelName: string) => `record/${modelName}`
export const getTombstoneTableName = (modelName: string) => `tombstone/${modelName}`
export const getRelationTableName = (modelName: string, propertyName: string) => `relation/${modelName}/${propertyName}`

export const getPropertyIndexName = (modelName: string, index: string[]) => `record/${modelName}/${index.join("/")}`

export const getRelationSourceIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/source`

export const getRelationTargetIndexName = (modelName: string, propertyName: string) =>
	`relation/${modelName}/${propertyName}/target`

const primitiveColumnTypes: Record<string, string> = {
	integer: "INTEGER",
	float: "FLOAT",
	string: "TEXT",
	bytes: "BLOB",
}

function getPropertyColumnType(property: Property): string {
	if (property.kind === "primitive") {
		const type = primitiveColumnTypes[property.type]
		return property.optional ? type : `${type} NOT NULL`
	} else if (property.kind === "reference") {
		return property.optional ? "TEXT" : "TEXT NOT NULL"
	} else if (property.kind === "relation") {
		throw new Error("internal error - relation properties don't map to columns")
	} else {
		signalInvalidType(property)
	}
}

const getPropertyColumn = (property: Property) => `'${property.name}' ${getPropertyColumnType(property)}`

export function initializeModel(model: Model, exec: (sql: string) => void) {
	const modelColumns = model.properties.flatMap((property) =>
		property.kind === "relation" ? [] : [getPropertyColumn(property)]
	)

	if (model.kind === "mutable") {
		modelColumns.push(`_key TEXT PRIMARY KEY NOT NULL`)
		modelColumns.push(`_metadata TEXT`)
		modelColumns.push(`_version TEXT`)
	} else if (model.kind === "immutable") {
		modelColumns.push(`_cid TEXT PRIMARY KEY NOT NULL`)
		modelColumns.push(`_metadata TEXT`)
	} else {
		signalInvalidType(model.kind)
	}

	const modelTableName = getRecordTableName(model.name)
	exec(`CREATE TABLE IF NOT EXISTS "${modelTableName}" (${modelColumns.join(", ")})`)

	if (model.kind === "mutable") {
		const tombstoneTableName = getTombstoneTableName(model.name)
		const tombstoneColumns = [`_key`, `_metadata TEXT`, `_version TEXT NOT NULL`]

		exec(`CREATE TABLE IF NOT EXISTS "${tombstoneTableName}" (${tombstoneColumns.join(", ")})`)
	}

	for (const index of model.indexes) {
		const indexName = getPropertyIndexName(model.name, index)
		const indexColumns = index.map((name) => `'${name}'`)
		exec(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${model.name}" (${indexColumns.join(", ")})`)
	}
}

export function initializeRelation(relation: Relation, exec: (sql: string) => void) {
	const relationTableName = getRelationTableName(relation.source, relation.property)

	const columns = [`_source TEXT NOT NULL`, `_target TEXT NOT NULL`]
	exec(`CREATE TABLE IF NOT EXISTS "${relationTableName}" (${columns.join(", ")})`)

	const sourceIndexName = getRelationSourceIndexName(relation.source, relation.property)
	exec(`CREATE INDEX IF NOT EXISTS "${sourceIndexName}" ON "${relationTableName}" (_source)`)

	if (relation.indexed) {
		const targetIndexName = getRelationTargetIndexName(relation.source, relation.property)
		exec(`CREATE INDEX IF NOT EXISTS "${targetIndexName}" ON "${relationTableName}" (_target)`)
	}
}
