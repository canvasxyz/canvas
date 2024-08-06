import fs from "node:fs"

import { Tree, Mode } from "@canvas-js/okra"
import { Tree as PersistentTree } from "@canvas-js/okra-lmdb"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb-sqlite"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public readonly db: ModelDB
	public readonly tree: Tree

	public constructor({ directory = null, ...init }: { directory?: string | null } & GossipLogInit<Payload>) {
		super(init)

		if (directory === null) {
			this.tree = new MemoryTree({ mode: Mode.Index })
			this.db = new ModelDB({
				path: null,
				models: AbstractGossipLog.schema,
			})
		} else {
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true })
			}

			const tree = new PersistentTree(`${directory}/message-index`, {
				mode: Mode.Index,
				mapSize: 0xffffffff,
			})

			this.tree = tree

			this.db = new ModelDB({
				path: `${directory}/db.sqlite`,
				models: AbstractGossipLog.schema,
			})
		}
	}

	public async close() {
		this.log("closing")
		await this.service?.stop()
		await this.tree.close()
		await this.db.close()
	}

	protected async rebuildMerkleIndex(): Promise<void> {
		if (this.tree instanceof MemoryTree) {
			// ...
		}
	}
}
