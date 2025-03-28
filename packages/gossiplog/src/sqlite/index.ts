import fs from "node:fs"

import { Tree, Mode } from "@canvas-js/okra"
import { Tree as PersistentTree } from "@canvas-js/okra-lmdb"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDBInit } from "@canvas-js/modeldb"
import { ModelDB } from "@canvas-js/modeldb-sqlite"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { initialUpgradeSchema } from "../utils.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(
		directory: string | null,
		init: GossipLogInit<Payload>,
	): Promise<GossipLog<Payload>> {
		const models = { ...init.schema, ...AbstractGossipLog.schema }
		const version = Object.assign(init.version ?? {}, AbstractGossipLog.baseVersion)
		const modelDBInit: ModelDBInit = {
			models: models,
			version: version,
			upgrade: async (upgradeAPI, oldConfig, oldVersion, newVersion) => {
				console.log(oldVersion, newVersion)
				await AbstractGossipLog.upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
				await init.upgrade?.(upgradeAPI, oldConfig, oldVersion, newVersion)
			},

			initialUpgradeSchema: Object.assign(init.initialUpgradeSchema ?? { ...models }, initialUpgradeSchema),
			initialUpgradeVersion: Object.assign(init.initialUpgradeVersion ?? { ...version }, {
				[AbstractGossipLog.namespace]: 1,
			}),
		}

		if (directory === null) {
			const db = await ModelDB.open(null, modelDBInit)

			const tree = new MemoryTree({ mode: Mode.Index })

			return new GossipLog(db, tree, init)
		} else {
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true })
			}

			const db = await ModelDB.open(`${directory}/db.sqlite`, modelDBInit)

			const tree = new PersistentTree(`${directory}/message-index`, {
				mode: Mode.Index,
				mapSize: 0xffffffff,
			})

			const gossipLog = new GossipLog(db, tree, init)
			await gossipLog.initialize()
			return gossipLog
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
