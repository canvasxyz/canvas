import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import { Snapshot } from "@canvas-js/interfaces"
import type { PropertyType } from "@canvas-js/modeldb"

import { Canvas } from "./Canvas.js"
import { Contract } from "./types.js"

// typeguards
export const isIndexInit = (value: unknown): value is string[] => Array.isArray(value)
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
	const snapshot: Snapshot = { type: "snapshot", models: {} }
	const { models } = await app.getApplicationData()

	for (const modelName of Object.keys(models)) {
		if (modelName.startsWith("$")) {
			continue
		}

		snapshot.models[modelName] = []
		for await (const row of app.db.iterate(modelName)) {
			snapshot.models[modelName].push(cbor.encode(row))
		}
	}

	return snapshot
}
