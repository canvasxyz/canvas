import fs from "node:fs"
import { resolve } from "node:path"

import { Mode } from "@canvas-js/okra"
import { Tree as PersistentTree } from "@canvas-js/okra-lmdb"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDBInit } from "@canvas-js/modeldb"
import { ModelDB } from "@canvas-js/modeldb-sqlite"

import { upgrade, baseVersion, initialUpgradeVersion, initialUpgradeSchema } from "#migrations"
import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(
		directory: string | null,
		init: GossipLogInit<Payload>,
	): Promise<GossipLog<Payload>> {
		const models = { ...init.schema, ...AbstractGossipLog.schema }
		const version = Object.assign(init.version ?? {}, baseVersion)

		if (directory === null) {
			const db = await ModelDB.open(null, { models, version })
			const tree = new MemoryTree({ mode: Mode.Index })
			return new GossipLog(db, tree, init)
		} else {
			let replayRequired = false
			const modelDBInit: ModelDBInit = {
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
			}

			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true })
			}

			const db = await ModelDB.open(resolve(directory, "db.sqlite"), modelDBInit)

			const tree = new PersistentTree(`${directory}/message-index`, {
				mode: Mode.Index,
				mapSize: 0xffffffff,
			})

			const gossipLog = new GossipLog(db, tree, init)

			if (replayRequired) {
				await gossipLog.replay()
			} else {
				await gossipLog.initialize()
			}

			return gossipLog
		}
	}

	protected async rebuildMerkleIndex(): Promise<void> {
		if (this.tree instanceof MemoryTree) {
			// ...
		}
	}
}
