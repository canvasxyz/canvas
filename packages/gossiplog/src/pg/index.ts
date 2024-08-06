import pg from "pg"

import { toString } from "uint8arrays"

import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb-pg"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { MerkleIndex } from "../MerkleIndex.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(
		connectionConfig: string | pg.ConnectionConfig,
		{ clear, ...init }: GossipLogInit<Payload> & { clear?: boolean },
	) {
		const db = await ModelDB.initialize({
			connectionConfig,
			models: AbstractGossipLog.schema,
			clear: clear,
		})

		const messageCount = await db.count("$messages")
		const merkleIndex = new MerkleIndex(db)
		const start = performance.now()
		const tree = await MemoryTree.fromEntries({ mode: Mode.Index }, merkleIndex.entries())
		const root = await tree.read((txn) => txn.getRoot())
		const delta = performance.now() - start

		const gossipLog = new GossipLog(db, tree, init)

		gossipLog.log(
			`build in-memory merkle tree (root %d:%s, %d entries, %dms)`,
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

	public async close() {
		this.log("closing")
		await this.service?.stop()
		await this.tree.close()
		await this.db.close()
	}
}
