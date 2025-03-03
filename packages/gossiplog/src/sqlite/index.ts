import fs from "node:fs"

import { Tree, Mode } from "@canvas-js/okra"
import { Tree as PersistentTree } from "@canvas-js/okra-lmdb"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB } from "@canvas-js/modeldb-sqlite"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(
		directory: string | null,
		init: GossipLogInit<Payload>,
	): Promise<GossipLog<Payload>> {
		if (directory === null) {
			const db = await ModelDB.open({
				path: null,
				models: { ...init.schema, ...AbstractGossipLog.schema },
				version: Object.assign(init.version ?? {}, {
					[AbstractGossipLog.namespace]: AbstractGossipLog.version,
				}),

				upgrade: async (upgradeAPI, oldVersion, newVersion) => {
					await AbstractGossipLog.upgrade(upgradeAPI, oldVersion, newVersion)
					await init.upgrade?.(upgradeAPI, oldVersion, newVersion)
				},
			})

			const tree = new MemoryTree({ mode: Mode.Index })

			return new GossipLog(db, tree, init)
		} else {
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true })
			}

			const db = await ModelDB.open({
				path: `${directory}/db.sqlite`,
				models: { ...init.schema, ...AbstractGossipLog.schema },
				version: Object.assign(init.version ?? {}, {
					[AbstractGossipLog.namespace]: AbstractGossipLog.version,
				}),

				upgrade: async (upgradeAPI, oldVersion, newVersion) => {
					await AbstractGossipLog.upgrade(upgradeAPI, oldVersion, newVersion)
					await init.upgrade?.(upgradeAPI, oldVersion, newVersion)
				},
			})

			const tree = new PersistentTree(`${directory}/message-index`, {
				mode: Mode.Index,
				mapSize: 0xffffffff,
			})

			return new GossipLog(db, tree, init)
		}
	}

	private constructor(public readonly db: ModelDB, public readonly tree: Tree, init: GossipLogInit<Payload>) {
		super(init)
	}

	protected async rebuildMerkleIndex(): Promise<void> {
		if (this.tree instanceof MemoryTree) {
			// ...
		}
	}
}
