import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"
import { ModelDB } from "@canvas-js/modeldb-sqlite-expo"

import { baseVersion, upgrade, initialUpgradeVersion, initialUpgradeSchema } from "#migrations"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({
		directory = null,
		...init
	}: { directory?: string | null; clear?: boolean } & GossipLogInit<Payload>) {
		let replayRequired = false
		const models = { ...init.schema, ...AbstractGossipLog.schema }
		const version = Object.assign(init.version ?? {}, baseVersion)

		const db = await ModelDB.open(null, {
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

		const tree = new MemoryTree({ mode: Mode.Index })
		const gossipLog = new GossipLog(db, tree, init)
		await gossipLog.initialize()
		return gossipLog
	}

	protected async rebuildMerkleIndex(): Promise<void> {
		if (this.tree instanceof MemoryTree) {
			// ...
		}
	}
}
