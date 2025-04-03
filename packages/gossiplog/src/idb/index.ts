import { toString } from "uint8arrays"

import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb-idb"

import { baseVersion, upgrade, initialUpgradeVersion, initialUpgradeSchema } from "#migrations"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { MerkleIndex } from "../MerkleIndex.js"

export interface Options {
	name?: string
}

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({ name, ...init }: GossipLogInit<Payload> & Options) {
		let replayRequired = false
		const models = { ...init.schema, ...AbstractGossipLog.schema }
		const version = Object.assign(init.version ?? {}, baseVersion)
		const db = await ModelDB.open(name ?? `canvas/v1/${init.topic}`, {
			models: models,
			version: version,
			upgrade: async (upgradeAPI, oldConfig, oldVersion, newVersion) => {
				await upgrade(upgradeAPI, oldConfig, oldVersion, newVersion).then((result) => {
					replayRequired ||= result
				})

				await init.upgrade?.(upgradeAPI, oldConfig, oldVersion, newVersion).then((result) => {
					replayRequired ||= result
				})
			},
			initialUpgradeSchema: Object.assign(init.initialUpgradeSchema ?? { ...models }, initialUpgradeSchema),
			initialUpgradeVersion: Object.assign(init.initialUpgradeVersion ?? { ...version }, initialUpgradeVersion),
		})

		const messageCount = await db.count("$messages")
		const merkleIndex = new MerkleIndex(db)
		const start = performance.now()
		const tree = await MemoryTree.fromEntries({ mode: Mode.Index }, merkleIndex.entries())
		const root = await tree.read((txn) => txn.getRoot())
		const delta = performance.now() - start

		const gossipLog = new GossipLog(db, tree, init)

		gossipLog.log(
			`built in-memory merkle tree (root %d:%s, %d entries, %dms)`,
			root.level,
			toString(root.hash, "hex"),
			messageCount,
			Math.round(delta),
		)

		if (replayRequired) {
			await gossipLog.replay()
		} else {
			await gossipLog.initialize()
		}

		return gossipLog
	}
}
