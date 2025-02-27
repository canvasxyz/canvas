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
		const db = await ModelDB.open({
			path: null,
			models: { ...init.schema, ...AbstractGossipLog.schema },
			// clear: init.clear,
		})

		return new GossipLog(db, tree, init)
	}

	private constructor(public readonly db: ModelDB, public readonly tree: Tree, init: GossipLogInit<Payload>) {
		super(init)

		// if (directory === null) {

		// } else {
		// 	if (!fs.existsSync(directory)) {
		// 		fs.mkdirSync(directory, { recursive: true })
		// 	}

		// 	const tree = new PersistentTree(`${directory}/message-index`, {
		// 		mode: Mode.Index,
		// 		mapSize: 0xffffffff,
		// 	})

		// 	this.tree = tree

		// 	this.db = new ModelDB({
		// 		path: `${directory}/db.sqlite`,
		// 		models: { ...init.schema, ...AbstractGossipLog.schema },
		// 	})
		// }
	}

	protected async rebuildMerkleIndex(): Promise<void> {
		if (this.tree instanceof MemoryTree) {
			// ...
		}
	}
}
