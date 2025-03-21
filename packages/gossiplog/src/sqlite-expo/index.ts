import { Tree, Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"
import { ModelDB } from "@canvas-js/modeldb-sqlite-expo"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { initialUpgradeSchema } from "../utils.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({
		directory = null,
		...init
	}: { directory?: string | null; clear?: boolean } & GossipLogInit<Payload>) {
		const models = { ...init.schema, ...AbstractGossipLog.schema }
		const version = Object.assign(init.version ?? {}, AbstractGossipLog.baseVersion)

		const db = await ModelDB.open(null, {
			models: models,
			version: version,
			upgrade: async (upgradeAPI, oldConfig, oldVersion, newVersion) => {
				await AbstractGossipLog.upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
				await init.upgrade?.(upgradeAPI, oldConfig, oldVersion, newVersion)
			},
			initialUpgradeSchema: Object.assign(init.initialUpgradeSchema ?? { ...models }, initialUpgradeSchema),
			initialUpgradeVersion: Object.assign(init.initialUpgradeVersion ?? { ...version }, {
				[AbstractGossipLog.namespace]: 1,
			}),
		})

		const tree = new MemoryTree({ mode: Mode.Index })
		const gossipLog = new GossipLog(db, tree, init)
		await gossipLog.initialize()
		return gossipLog
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
