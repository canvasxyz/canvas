import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { Snapshot, SnapshotEffect } from "@canvas-js/interfaces"
import type { PropertyType } from "@canvas-js/modeldb"

import { Canvas } from "./Canvas.js"
import { Contract, ModelSchema, ModelValue } from "./types.js"
import { EffectRecord } from "./runtime/AbstractRuntime.js"

// typeguards
export const isIndexInit = (value: unknown): value is string[] => Array.isArray(value)
export const isPropertyTypish = (value: unknown): value is PropertyType => typeof value === "string"

export type Changeset =
	| {
			change: "create_table"
			table: string
	  }
	| {
			change: "drop_table"
			table: string
	  }
	| {
			change: "add_column"
			table: string
			column: string
			propertyType: PropertyType
	  }
	| {
			change: "remove_column"
			table: string
			column: string
	  }
	| {
			change: "make_optional_column"
			table: string
			column: string
	  }

export function hashContract<T extends Contract<any>>(contract: T | string): string {
	if (typeof contract === "string") {
		const hash = sha256(contract)
		return bytesToHex(hash)
	} else {
		const contractCodeMap: Record<string, string> = Object.fromEntries(
			Object.entries(contract.actions).map(([name, fn]) => [name, fn.toString()]),
		)
		const actionHash = sha256(cbor.encode(contractCodeMap))
		const modelHash = sha256(cbor.encode(contract.models))
		const hash = sha256(cbor.encode({ actions: actionHash, models: modelHash }))
		return bytesToHex(hash)
	}
}

export function hashSnapshot(snapshot: Snapshot): string {
	const hash = sha256(cbor.encode(snapshot))
	return bytesToHex(hash).slice(0, 16)
}

/**
 * Create a `Snapshot` of the application's current database state.
 *
 * If changesets are provided, then apply them to snapshotted tables, so
 * the new snapshot can be used with a contract matching them immediately.
 */
export async function createSnapshot<T extends Contract<any>>(
	app: Canvas,
	changesets: Changeset[] = [],
): Promise<Snapshot> {
	const createdTables = changesets.filter((ch) => ch.change === "create_table").map((ch) => ch.table)
	const droppedTables = changesets.filter((ch) => ch.change === "drop_table").map((ch) => ch.table)
	const removedColumns: Record<string, string[]> = {}
	const addedColumns: Record<string, Record<string, string>> = {}
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
			addedColumns[table][column] = propertyType
		})

	// flatten models
	const modelData: Record<string, Uint8Array[]> = {}
	for (const [modelName, modelSchema] of Object.entries(app.db.models)) {
		if (modelName.startsWith("$")) {
			continue
		}
		if (droppedTables.includes(modelName)) {
			continue
		}
		modelData[modelName] = []
		for await (const row of app.db.iterate(modelName)) {
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
			modelData[modelName].push(cbor.encode(row))
		}
	}
	for (const table of createdTables) {
		modelData[table] = []
	}
	const models = modelData

	// flatten $effects table
	const effectsMap = new Map<string, EffectRecord>()
	for await (const row of app.db.iterate<EffectRecord>("$effects")) {
		const { key, value, branch, clock } = row
		const [table, keyhash, msgid] = key.split("/")
		const recordId = [table, keyhash].join("/")
		const existingEffect = effectsMap.get(recordId)
		if (!existingEffect || clock > existingEffect.clock) {
			const effectKey = `${recordId}/${MIN_MESSAGE_ID}`
			let updatedValue = value
			if (value !== null && (addedColumns[table] || removedColumns[table])) {
				const decodedValue = cbor.decode<ModelValue | null>(value)
				if (decodedValue !== null) {
					for (const key of Object.keys(addedColumns[table])) {
						decodedValue[key] = null
						updatedValue = cbor.encode(decodedValue)
					}
					for (const key of removedColumns[table]) {
						delete decodedValue[key]
						updatedValue = cbor.encode(decodedValue)
					}
				}
			}
			effectsMap.set(recordId, { key: effectKey, value: updatedValue, branch, clock })
		}
	}
	const effects = Array.from(effectsMap.values()).map(({ key, value }: SnapshotEffect) => ({ key, value }))

	return {
		type: "snapshot",
		models,
		effects,
	}
}

export const generateChangesets = (before: ModelSchema, after: ModelSchema) => {
	const changesets: Changeset[] = []

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
