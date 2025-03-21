import { toString } from "uint8arrays"

import { Mode } from "@canvas-js/okra"
import { Tree as MemoryTree } from "@canvas-js/okra-memory"

import { ModelDB, ModelDBProxy } from "@canvas-js/modeldb-durable-objects"

import { Unstable_DevWorker } from "wrangler"
import { SqlStorage } from "@cloudflare/workers-types"

import { AbstractGossipLog, GossipLogInit } from "../AbstractGossipLog.js"
import { MerkleIndex } from "../MerkleIndex.js"
import { initialUpgradeSchema } from "../utils.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>({
		db,
		worker,
		useTestProxy,
		clear,
		...init
	}: {
		db?: SqlStorage
		worker?: Unstable_DevWorker
		useTestProxy?: boolean
		clear?: boolean
	} & GossipLogInit<Payload>) {
		let mdb: ModelDB | ModelDBProxy

		if (useTestProxy && worker) {
			mdb = new ModelDBProxy(worker, { ...init.schema, ...AbstractGossipLog.schema })
			await mdb.initialize()
		} else if (!useTestProxy && db) {
			const models = { ...init.schema, ...AbstractGossipLog.schema }
			const version = Object.assign(init.version ?? {}, AbstractGossipLog.baseVersion)

			mdb = await ModelDB.open(db, {
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
		} else {
			throw new Error("must provide db or worker && useTestProxy")
		}

		if (clear) {
			for (const table of Object.keys({ ...init.schema, ...AbstractGossipLog.schema })) {
				await mdb.clear(table)
			}
		}

		const messageCount = await mdb.count("$messages")
		const merkleIndex = new MerkleIndex(mdb)
		const start = performance.now()
		const tree = await MemoryTree.fromEntries({ mode: Mode.Index }, merkleIndex.entries())
		const root = await tree.read((txn) => txn.getRoot())
		const delta = performance.now() - start

		const gossipLog = new GossipLog(mdb, tree, init)
		gossipLog.log(
			`build in-memory merkle tree (root %d:%s, %d entries, %dms)`,
			root.level,
			toString(root.hash, "hex"),
			messageCount,
			Math.round(delta),
		)

		await gossipLog.initialize()
		return gossipLog
	}

	private constructor(
		public readonly db: ModelDB | ModelDBProxy,
		public readonly tree: MemoryTree,
		init: GossipLogInit<Payload>,
	) {
		super(init)
	}
}
