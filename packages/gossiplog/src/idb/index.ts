import { toString } from "uint8arrays"

import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb-idb"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { MerkleIndex } from "../MerkleIndex.js"

export interface Options {
	name?: string
}

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({ name, ...init }: GossipLogInit<Payload> & Options) {
		const db = await ModelDB.open({
			name: name ?? `canvas/v1/${init.topic}`,
			models: { ...init.schema, ...AbstractGossipLog.schema },
			version: Object.assign(init.version ?? {}, {
				[AbstractGossipLog.namespace]: AbstractGossipLog.version,
			}),

			upgrade: async (upgradeAPI, oldVersion, newVersion) => {
				await AbstractGossipLog.upgrade(upgradeAPI, oldVersion, newVersion)
				await init.upgrade?.(upgradeAPI, oldVersion, newVersion)
			},
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

		return gossipLog
	}

	private constructor(public readonly db: ModelDB, public readonly tree: MemoryTree, init: GossipLogInit<Payload>) {
		super(init)
	}
}
