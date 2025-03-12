import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { Snapshot, SnapshotEffect } from "@canvas-js/interfaces"
import type { PropertyType } from "@canvas-js/modeldb"

import { Canvas } from "./Canvas.js"
import { Contract, ModelSchema } from "./types.js"
import { EffectRecord } from "./runtime/AbstractRuntime.js"

// typeguards
export const isIndexInit = (value: unknown): value is string[] => Array.isArray(value)
export const isPropertyTypish = (value: unknown): value is PropertyType => typeof value === "string"

export type Migration =
	| {
			migration: "create_table"
			table: string
	  }
	| {
			migration: "drop_table"
			table: string
	  }
	| {
			migration: "add_column"
			table: string
			column: string
	  }
	| {
			migration: "remove_column"
			table: string
			column: string
	  }
	| {
			migration: "make_optional_column"
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

export async function createSnapshot<T extends Contract<any>>(app: Canvas): Promise<Snapshot> {
	// flatten models
	const modelData: Record<string, Uint8Array[]> = {}
	for (const [modelName, modelSchema] of Object.entries(app.db.models)) {
		if (modelName.startsWith("$")) {
			continue
		}
		modelData[modelName] = []
		for await (const row of app.db.iterate(modelName)) {
			modelData[modelName].push(cbor.encode(row))
		}
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
			effectsMap.set(recordId, { key: effectKey, value, branch, clock })
		}
	}
	const effects = Array.from(effectsMap.values()).map(({ key, value }: SnapshotEffect) => ({ key, value }))

	return {
		type: "snapshot",
		models,
		effects,
	}
}

export const generateMigrations = (before: ModelSchema, after: ModelSchema) => {
	const migrations: Migration[] = []

	const addedTables = Object.keys(after).filter((table) => !(table in before))
	addedTables.forEach((table) => {
		migrations.push({
			migration: "create_table",
			table,
		})
	})
	const deletedTables = Object.keys(before).filter((table) => !(table in after))
	deletedTables.forEach((table) => {
		migrations.push({
			migration: "drop_table",
			table,
		})
	})

	const existingTables = Object.keys(before).filter((table) => table in after)
	for (const table of existingTables) {
		const beforeTable = before[table]
		const afterTable = after[table]

		const addedColumns = Object.keys(afterTable).filter((column) => !(column in beforeTable))
		addedColumns.forEach((column) => {
			migrations.push({
				migration: "add_column",
				table: table,
				column,
			})
		})
		const removedColumns = Object.keys(beforeTable).filter((column) => !(column in afterTable))
		removedColumns.forEach((column) => {
			migrations.push({
				migration: "remove_column",
				table: table,
				column,
			})
		})
		const existingColumns = Object.keys(beforeTable).filter((column) => column in afterTable)
		existingColumns.forEach((column) => {
			if (column === "$indexes") {
				// const beforeIndexes = beforeTable["$indexes"] as string[]
				// const afterIndexes = afterTable["$indexes"] as string[]

				// we don't need to generate migrations for indexes
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
					migrations.push({
						migration: "make_optional_column",
						table,
						column,
					})
				} else {
					throw new Error(`can't change column ${table} from ${beforeType} to ${afterType}`)
				}
			}
		})
	}

	return migrations
}
