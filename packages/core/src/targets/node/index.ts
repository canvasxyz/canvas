import path from "node:path"
import type pg from "pg"

import { createEd25519PeerId, createFromProtobuf } from "@libp2p/peer-id-factory"
import { createLibp2p } from "libp2p"

import { Action, Session } from "@canvas-js/interfaces"
import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { GossipLog as SqliteGossipLog } from "@canvas-js/gossiplog/sqlite"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { ModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb-pg"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

export default {
	async openDB(location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean }, models) {
		if (location.path === null) {
			return new ModelDB({ path: null, models })
		} else if (isPostgres(location.path)) {
			return await PostgresModelDB.initialize({ connectionConfig: location.path, models, clear: location.clear })
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			// TODO: delete db.sqlite
			return new ModelDB({ path: path.resolve(location.path, "db.sqlite"), models })
		}
	},

	async openGossipLog(location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean }, init) {
		if (location.path === null) {
			return new SqliteGossipLog(init)
		} else if (isPostgres(location.path)) {
			return await PostgresGossipLog.open(location.path, { ...init, clear: location.clear })
		} else {
			// TODO: delete topics/
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			return new SqliteGossipLog({
				directory: path.resolve(location.path, "topics", init.topic),
				...init,
			})
		}
	},

	createLibp2p: async (messageLog: AbstractGossipLog<Action | Session>, config) => {
		const peerId = await getPeerId()
		return await createLibp2p(getLibp2pOptions(messageLog, peerId, config))
	},
} satisfies PlatformTarget

async function getPeerId() {
	const { PEER_ID } = process.env
	if (typeof PEER_ID === "string") {
		return await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
	} else {
		return await createEd25519PeerId()
	}
}
