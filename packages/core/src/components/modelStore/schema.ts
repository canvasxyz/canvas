import type { Model, ModelType } from "@canvas-js/interfaces"

import { signalInvalidType, assert } from "@canvas-js/core/utils"

// We have to be sure to quote these because, even though we validate that they're all [a-z_]+ elsewhere,
// because they might be reserved SQL keywords.
export const getModelTableName = (modelName: string) => `'${modelName}'`
export const getDeletedTableName = (modelName: string) => `'_${modelName}_deleted'`
export const getPropertyName = (propertyName: string) => `'${propertyName}'`
export const getIndexName = (modelName: string, i: number) => `'_${modelName}_index_${i}'`

export function getColumnType(type: ModelType): string {
	switch (type) {
		case "boolean":
			return "INTEGER"
		case "string":
			return "TEXT"
		case "integer":
			return "INTEGER"
		case "float":
			return "FLOAT"
		case "datetime":
			return "INTEGER"
		default:
			signalInvalidType(type)
	}
}

export function initializeModelTables(models: Record<string, Model>, exec: (sql: string) => void) {
	for (const [name, { indexes, id, updated_at, ...properties }] of Object.entries(models)) {
		assert(id === "string", "id property must be 'string'")
		assert(updated_at === "datetime", "updated_at property must be 'datetime'")

		const deletedTableName = getDeletedTableName(name)
		const createDeletedTable = `CREATE TABLE IF NOT EXISTS ${deletedTableName} (id TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);`
		exec(createDeletedTable)

		const columns = ["id TEXT PRIMARY KEY NOT NULL", "updated_at INTEGER NOT NULL"]
		for (const [property, type] of Object.entries(properties)) {
			columns.push(`'${property}' ${getColumnType(type)}`)
		}

		const tableName = getModelTableName(name)

		const createTable = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`
		exec(createTable)

		if (indexes !== undefined) {
			for (const [i, index] of indexes.entries()) {
				const properties = Array.isArray(index) ? index : [index]
				const propertyNames = properties.map(getPropertyName)
				const indexName = getIndexName(name, i)
				exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${propertyNames.join(", ")});`)
			}
		}
	}
}

export function getModelStatements(name: string, { id, updated_at, indexes, ...properties }: Model) {
	const keys = ["updated_at", ...Object.keys(properties)]
	const values = keys.map((key) => `:${key}`).join(", ")
	const updates = keys.map((key) => `${getPropertyName(key)} = :${key}`).join(", ")

	const tableName = getModelTableName(name)
	const deletedTableName = getDeletedTableName(name)
	return {
		insert: `INSERT INTO ${tableName} VALUES (:id, ${values})`,
		update: `UPDATE ${tableName} SET ${updates} WHERE id = :id`,
		delete: `DELETE FROM ${tableName} WHERE id = :id`,
		insertDeleted: `INSERT INTO ${deletedTableName} VALUES (:id, :deleted_at)`,
		updateDeleted: `UPDATE ${deletedTableName} SET deleted_at = :deleted_at WHERE id = :id`,
		getUpdatedAt: `SELECT updated_at FROM ${tableName} WHERE id = ?`,
		getDeletedAt: `SELECT deleted_at FROM ${deletedTableName} WHERE id = ?`,
		export: `SELECT * FROM ${tableName} ORDER BY updated_at DESC LIMIT :limit OFFSET :offset`,
		count: `SELECT COUNT(*) FROM ${tableName}`,
	}
}

export type ModelStatements = keyof ReturnType<typeof getModelStatements>
