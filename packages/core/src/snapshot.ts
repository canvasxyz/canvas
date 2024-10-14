import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { Snapshot, SnapshotEffect } from "@canvas-js/interfaces"
import { assert, mapValues } from "@canvas-js/utils"
import type { ModelSchema, IndexInit, PropertyType, ModelValue } from "@canvas-js/modeldb"

import { Canvas } from "./Canvas.js"
import { Contract } from "./types.js"
import { EffectRecord } from "./runtime/AbstractRuntime.js"

// typeguards
export const isMergeFunction = (value: unknown): value is ModelSchema["$merge"] =>
	typeof value === "function" || value === undefined
export const isIndexInit = (value: unknown): value is IndexInit[] => typeof value === "string" || Array.isArray(value)
export const isPropertyTypish = (value: unknown): value is PropertyType => typeof value === "string"

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
			const rowWithZeroedIndexedAt = Object.fromEntries(
				Object.entries(row).map(([key, value]) => {
					if (key === "$indexed_at") {
						return [key, 0]
					}
					return [key, value]
				}),
			) as ModelValue
			modelData[modelName].push(cbor.encode(rowWithZeroedIndexedAt))
		}
	}
	const models = modelData

	// flatten $effects table
	const effectsMap = new Map<string, EffectRecord>()
	for await (const row of app.db.iterate<EffectRecord>("$effects")) {
		const { key, value, branch, clock } = row
		const [table, keyhash, id] = key.split("/")
		const existingEffect = effectsMap.get(keyhash)
		if (!existingEffect || clock > existingEffect.clock) {
			effectsMap.set(keyhash, {
				key: `${table}/${keyhash}/${MIN_MESSAGE_ID}`,
				value,
				branch,
				clock,
			})
		}
	}
	const effects = Array.from(effectsMap.values()).map(({ key, value }: SnapshotEffect) => ({ key, value }))

	return {
		type: "snapshot",
		models,
		effects,
	}
}
