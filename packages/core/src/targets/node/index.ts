import path from "node:path"
import fs from "node:fs"
import type pg from 'pg'

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLog as MemoryGossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { ModelDB } from "@canvas-js/modeldb/sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb/pg"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

const PEER_ID_FILENAME = ".peer-id"

const isPostgres = (path: string) => path.startsWith("postgres://") || path.startsWith("postgresql://")

export default {
	async openDB(location: { path: string | pg.ConnectionConfig | null; topic: string }, models, { indexHistory } = {}) {
		if (location.path === null) {
			return new ModelDB({ path: null, models, indexHistory })
		} else if (typeof location.path === "string" && !isPostgres(location.path)) {
			return new ModelDB({ path: path.resolve(location.path, "db.sqlite"), models, indexHistory })
		} else {
			return await PostgresModelDB.initialize({ connectionConfig: location.path, models, indexHistory })
		}
	},

	async openGossipLog<Payload, Result>(
		location: { path: string | pg.ConnectionConfig | null; topic: string },
		init: GossipLogInit<Payload, Result>,
	) {
		if (location.path === null) {
			return await MemoryGossipLog.open(init)
		} else if (typeof location.path === "string" && !isPostgres(location.path)) {
			return await GossipLog.open(init, path.resolve(location.path, "topics", init.topic))
		} else {
			return await PostgresGossipLog.open(init, location.path)
		}
	},

	createLibp2p: async (location, config) => {
		const peerId = await getPeerId(location)
		return await createLibp2p(getLibp2pOptions(peerId, config))
	},
} satisfies PlatformTarget

async function getPeerId(location: { topic: string; path: string | pg.ConnectionConfig | null }): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	if (location.path === null) {
		return await createEd25519PeerId()
	}

	if (typeof location.path !== 'string') {
		throw new Error('unimplemented: peerId in postgres')
	}

	const peerIdPath = path.resolve(location.path, PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		return await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64"))
	}

	const peerId = await createEd25519PeerId()
	fs.writeFileSync(peerIdPath, Buffer.from(exportToProtobuf(peerId)).toString("base64"))
	return peerId
}
