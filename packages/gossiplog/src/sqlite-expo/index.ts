import { Tree, Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"
import { ModelDB } from "@canvas-js/modeldb-sqlite-expo"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({
		directory = null,
		...init
	}: { directory?: string | null; clear?: boolean } & GossipLogInit<Payload>) {
		const tree = new MemoryTree({ mode: Mode.Index })
		const db = await ModelDB.open(null, {
			models: { ...init.schema, ...AbstractGossipLog.schema },
			version: Object.assign(init.version ?? {}, {
				[AbstractGossipLog.namespace]: AbstractGossipLog.version,
			}),

			upgrade: async (upgradeAPI, oldVersion, newVersion) => {
				await AbstractGossipLog.upgrade(upgradeAPI, oldVersion, newVersion)
				await init.upgrade?.(upgradeAPI, oldVersion, newVersion)
			},
		})

		return new GossipLog(db, tree, init)
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
