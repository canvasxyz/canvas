import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"
import * as cbor from "@ipld/dag-cbor"

import * as espree from "espree"
import * as eslintScope from "eslint-scope"
import globals from "globals"

import { MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { Snapshot, SnapshotEffect, SnapshotActionSchema, SnapshotModelSchema } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"
import type { ModelSchema, IndexInit, PropertyType } from "@canvas-js/modeldb"

import { Canvas } from "./Canvas.js"
import { Contract } from "./types.js"
import { EffectRecord } from "./runtime/AbstractRuntime.js"

// typeguards
export const isMergeFunction = (value: unknown): value is ModelSchema["$merge"] =>
	typeof value === "function" || value === undefined
export const isIndexInit = (value: unknown): value is IndexInit[] => typeof value === "string" || Array.isArray(value)
export const isPropertyTypish = (value: unknown): value is PropertyType => typeof value === "string"

function serializeActions(contract: Contract): SnapshotActionSchema {
	const result: Record<string, string> = {}
	for (const [name, fn] of Object.entries(contract.actions)) {
		result[name] = fn.toString()
	}
	return result
}

function serializeModels(contract: Contract): SnapshotModelSchema {
	const result: SnapshotModelSchema = {}
	for (const [modelName, modelSchema] of Object.entries(contract.models)) {
		result[modelName] = {}
		for (const [key, value] of Object.entries(modelSchema)) {
			if (key === "$merge") {
				assert(isMergeFunction(value))
				result[modelName][key] = typeof value === "function" ? value.toString() : value
			} else if (key === "$indexes") {
				assert(isIndexInit(value))
				result[modelName][key] = value
			} else {
				assert(isPropertyTypish(value))
				result[modelName][key] = value
			}
		}
	}
	return result
}

function createContractSnapshot<T extends Contract>(config: CanvasConfig<T>) {
	if (typeof config.contract === "string") {
		return {
			file: config.contract,
			hash: hashContract(config.contract),
		}
	} else {
		return {
			actions: serializeActions(config.contract),
			models: serializeModels(config.contract),
			hash: hashContract(config.contract),
		}
	}
}

export function checkContract(contract: Contract): boolean {
	function hasDanglingReferences(code: string) {
		// use latest quickjs supported version (es2023)
		const ast = espree.parse(code, { range: true, ecmaVersion: 2023 })
		const scopeManager = eslintScope.analyze(ast, { ecmaVersion: 2023 })
		scopeManager.globalScope.through.forEach((ref) => {
			if (ref.identifier.name in globals.es2023 || ref.identifier.name in globals.browser) return
			console.warn("unexpected reference in function", ref.identifier.name, "at char", ref.identifier.range?.[0])
			return true
		})
		return false
	}
	let valid = true
	for (const model of Object.values(contract.models)) {
		if (model.$merge === undefined) {
			continue
		}
		if (hasDanglingReferences(model.$merge.toString())) {
			valid = false
		}
	}
	for (const fn of Object.values(contract.actions)) {
		if (hasDanglingReferences(fn.toString())) {
			valid = false
		}
	}
	return valid
}

export function hashContract<T extends Contract>(contract: T | string): string {
	if (typeof contract === "string") {
		const hash = sha256(contract)
		return bytesToHex(hash)
	} else {
		if (!checkContract(contract)) {
			console.warn("unexpected references inside action functions")
		}
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

export async function createSnapshot<T extends Contract>(app: Canvas): Promise<Snapshot> {
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
		contract: createContractSnapshot(app.config),
	}
}
