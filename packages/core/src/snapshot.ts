import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { Snapshot } from "@canvas-js/interfaces"
import type { PrimitiveType, Property, PropertyType } from "@canvas-js/modeldb"

import { Contract } from "@canvas-js/core/contract"
import { Canvas } from "./Canvas.js"

import { ContractClass, ModelSchema, ModelValue } from "./types.js"

// typeguards
export const isIndexInit = (value: unknown): value is string[] => Array.isArray(value)
export const isPropertyTypish = (value: unknown): value is PropertyType => typeof value === "string"

export type CreateTableChange = {
	change: "create_table"
	table: string
}
export type DropTableChange = {
	change: "drop_table"
	table: string
}
export type AddColumnChange = {
	change: "add_column"
	table: string
	column: string
	propertyType: PropertyType
}
export type RemoveColumnChange = {
	change: "remove_column"
	table: string
	column: string
}
export type MakeOptionalColumnChange = {
	change: "make_optional_column"
	table: string
	column: string
}

export type TableChange =
	| CreateTableChange
	| DropTableChange
	| AddColumnChange
	| RemoveColumnChange
	| MakeOptionalColumnChange

export function hashContract<T extends ContractClass<ModelSchema>>(contract: T | string): string {
	if (typeof contract === "string") {
		const hash = sha256(contract)
		return bytesToHex(hash)
	} else {
		throw new Error("not implemented (hash class contract)")
	}
}

export type RowChange =
	| {
			type: "delete"
	  }
	| {
			type: "create"
			value: ModelValue
	  }
	| {
			type: "update"
			value: ModelValue
	  }

export type CreateSnapshotArgs = {
	changesets?: TableChange[]
	changedRows?: Record<string, Record<string, RowChange>>
	newRows?: Record<string, ModelValue[]>
}

/**
 * Create a `Snapshot` of the application's current database state.
 *
 * If changesets are provided, then apply them to snapshotted tables, so
 * the new snapshot can be used with a contract matching them immediately.
 */
export async function createSnapshot(app: Canvas, changes?: CreateSnapshotArgs): Promise<Snapshot> {
	const changesets = changes?.changesets ?? []
	const changedRows = changes?.changedRows ?? {}

	const createdTables = changesets.filter((ch) => ch.change === "create_table").map((ch) => ch.table)
	const droppedTables = changesets.filter((ch) => ch.change === "drop_table").map((ch) => ch.table)
	const removedColumns: Record<string, string[]> = {}
	const addedColumns: Record<string, Property[]> = {}
	changesets
		.filter((ch) => ch.change === "remove_column")
		.forEach(({ table, column }) => {
			removedColumns[table] = removedColumns[table] ?? []
			removedColumns[table].push(column)
		})
	changesets
		.filter((ch) => ch.change === "add_column")
		.forEach(({ table, column, propertyType }) => {
			addedColumns[table] = addedColumns[table] ?? []
			addedColumns[table].push({
				name: column,
				kind: "primitive",
				type: propertyType as PrimitiveType,
				nullable: true,
			})
		})

	// flatten models
	const models: Record<string, Uint8Array[]> = {}
	for (const [modelName, modelSchema] of Object.entries(app.db.models)) {
		if (modelName.startsWith("$")) {
			continue
		} else if (droppedTables.includes(modelName)) {
			continue
		}

		models[modelName] = []

		const modelChangedRows = changedRows[modelName] ?? {}

		for await (const row of app.db.iterate(modelName)) {
			// check if the row is deleted, if so then skip it
			const rowKey = JSON.stringify(modelSchema.primaryKey.map((key) => row[key])) as string

			const rowChange = modelChangedRows[rowKey]
			if (rowChange) {
				// skip deleted rows
				if (rowChange.type === "delete") {
					continue
				}

				// update rows
				if (rowChange.type === "update") {
					for (const key of Object.keys(rowChange.value)) {
						row[key] = rowChange.value[key]
					}
				}
			}

			if (addedColumns[modelName]) {
				for (const key of Object.keys(addedColumns[modelName])) {
					row[key] = null
				}
			}

			if (removedColumns[modelName]) {
				for (const key of removedColumns[modelName]) {
					delete row[key]
				}
			}

			models[modelName].push(cbor.encode(row))
		}

		// add created rows
		for (const [_rowKey, rowChange] of Object.entries(modelChangedRows)) {
			if (rowChange.type === "create") {
				models[modelName].push(cbor.encode(rowChange.value))
			}
		}
	}

	for (const table of createdTables) {
		models[table] = []
	}

	return { type: "snapshot", models }
}

export const generateChangesets = (before: ModelSchema, after: ModelSchema) => {
	const changesets: TableChange[] = []

	const addedTables = Object.keys(after).filter((table) => !(table in before))
	addedTables.forEach((table) => {
		changesets.push({
			change: "create_table",
			table,
		})
	})
	const deletedTables = Object.keys(before).filter((table) => !(table in after))
	deletedTables.forEach((table) => {
		changesets.push({
			change: "drop_table",
			table,
		})
	})

	const existingTables = Object.keys(before).filter((table) => table in after)
	for (const table of existingTables) {
		const beforeTable = before[table]
		const afterTable = after[table]

		const addedColumns = Object.keys(afterTable).filter((column) => !(column in beforeTable))
		addedColumns.forEach((column) => {
			changesets.push({
				change: "add_column",
				table: table,
				column,
				propertyType: (afterTable as Record<string, PropertyType>)[column],
			})
		})
		const removedColumns = Object.keys(beforeTable).filter((column) => !(column in afterTable))
		removedColumns.forEach((column) => {
			changesets.push({
				change: "remove_column",
				table: table,
				column,
			})
		})
		const existingColumns = Object.keys(beforeTable).filter((column) => column in afterTable)
		existingColumns.forEach((column) => {
			if (column === "$indexes") {
				// const beforeIndexes = beforeTable["$indexes"] as string[]
				// const afterIndexes = afterTable["$indexes"] as string[]

				// we don't need to generate changes for indexes
				// because tables will be repopulated from empty anyway
				return
			} else if (column === "$primary") {
				throw new Error(`can't change primary key of ${table}`)
			} else {
				const beforeType = (beforeTable as Record<string, PropertyType>)[column]
				const afterType = (afterTable as Record<string, PropertyType>)[column]
				if (beforeType === afterType) {
					return
				} else if (beforeType + "?" === afterType) {
					changesets.push({
						change: "make_optional_column",
						table,
						column,
					})
				} else {
					throw new Error(`can't change column ${table} from ${beforeType} to ${afterType}`)
				}
			}
		})
	}

	return changesets
}
