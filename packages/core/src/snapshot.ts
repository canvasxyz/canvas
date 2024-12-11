import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { Snapshot, SnapshotEffect } from "@canvas-js/interfaces"
import type { IndexInit, PropertyType } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { Canvas } from "./Canvas.js"
import { Contract } from "./types.js"
import { WriteRecord } from "./runtime/AbstractRuntime.js"

// typeguards
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

export async function createSnapshot(app: Canvas): Promise<Snapshot> {
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

	const effects: SnapshotEffect[] = []

	// flatten $writes table
	const writesMap = new Map<string, Uint8Array | null>()
	for await (const writeRecord of app.db.iterate<WriteRecord>("$writes", { where: { reverted: false } })) {
		const [recordId, _] = writeRecord.key.split(":")
		writesMap.set(recordId, writeRecord.value)
	}

	for (const [recordId, value] of writesMap) {
		const record = await app.db.get("$records", recordId)
		assert(record !== null, "expected record !== null", { recordId })
		const { model, key } = record
		effects.push({ model, key, value })
	}

	return { type: "snapshot", models, effects }
}

function lessThan(a: string | null, b: string | null) {
	if (a === null && b === null) {
		return false
	} else if (a === null) {
		return true
	} else if (b === null) {
		return false
	} else {
		return a < b
	}
}
