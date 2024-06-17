import { toString } from "uint8arrays"

import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb/idb"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { MerkleIndex } from "../MerkleIndex.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(init: GossipLogInit<Payload>) {
		const db = await ModelDB.initialize({
			name: `canvas/${init.topic}`,
			models: AbstractGossipLog.schema,
		})

		const messageCount = await db.count("$messages")
		const merkleIndex = new MerkleIndex(db)
		const start = performance.now()
		const tree = await MemoryTree.fromEntries({ mode: Mode.Index }, merkleIndex.entries())
		const root = await tree.read((txn) => txn.getRoot())
		const delta = performance.now() - start
		console.log(
			`rebuilt in-memory merkle tree (root ${root.level}:${toString(root.hash, "hex")}, ${messageCount} entries, ${Math.round(delta)}ms)`,
		)

		return new GossipLog(db, tree, init)
	}

	private constructor(
		public readonly db: ModelDB,
		public readonly tree: MemoryTree,
		init: GossipLogInit<Payload>,
	) {
		super(init)
	}

	public async close() {
		this.log("closing")
		await this.db.close()
	}
}
