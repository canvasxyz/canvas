import path from "node:path"
import fs from "node:fs"
import type pg from "pg"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLog as MemoryGossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { ModelDB } from "@canvas-js/modeldb/sqlite"
import { ModelDB as PostgresModelDB } from "@canvas-js/modeldb/pg"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

const PEER_ID_FILENAME = ".peer-id"

const isPostgres = (path: string | pg.ConnectionConfig): boolean =>
	typeof path !== "string" || path.startsWith("postgres://") || path.startsWith("postgresql://")

export default {
	async openDB(
		location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean },
		models,
		{ indexHistory } = {},
	) {
		if (location.path === null) {
			return new ModelDB({ path: null, models, indexHistory })
		} else if (isPostgres(location.path)) {
			return await PostgresModelDB.initialize({
				connectionConfig: location.path,
				models,
				indexHistory,
				clear: location.clear,
			})
		} else {
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			// TODO: delete db.sqlite
			return new ModelDB({ path: path.resolve(location.path, "db.sqlite"), models, indexHistory })
		}
	},

	async openGossipLog<Payload, Result>(
		location: { path: string | pg.ConnectionConfig | null; topic: string; clear?: boolean },
		init: GossipLogInit<Payload, Result>,
	) {
		if (location.path === null) {
			return await MemoryGossipLog.open(init)
		} else if (isPostgres(location.path)) {
			return await PostgresGossipLog.open(init, location.path, location.clear)
		} else {
			// TODO: delete topics/
			assert(typeof location.path === "string", 'expected typeof location.path === "string"')
			return await GossipLog.open(init, path.resolve(location.path, "topics", init.topic))
		}
	},

	createLibp2p: async (location, config) => {
		const peerId = await getPeerId(location)
		return await createLibp2p(getLibp2pOptions(peerId, config))
	},
} satisfies PlatformTarget

async function getPeerId(location: {
	topic: string
	path: string | pg.ConnectionConfig | null
	clear?: boolean
}): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	if (location.path === null) {
		// create ephemeral peer id
		return await createEd25519PeerId()
	} else if (isPostgres(location.path)) {
		// create peer id in postgres
		const pg_ = await import("pg")
		const client = new pg_.default.Client(location.path)
		await client.connect()

		if (location.clear) {
			await client.query("DROP TABLE IF EXISTS canvas_peerids")
		}
		await client.query("CREATE TABLE IF NOT EXISTS canvas_peerids (peerid TEXT, topic TEXT)")
		const { rows } = await client.query("SELECT peerid FROM canvas_peerids WHERE topic = $1", [location.topic])

		if (rows[0] !== undefined) {
			await client.end()
			return await createFromProtobuf(Buffer.from(rows[0].peerid, "base64"))
		}

		const newPeerId = await createEd25519PeerId()
		const encoded = Buffer.from(exportToProtobuf(newPeerId)).toString("base64")
		await client.query<{}>("INSERT INTO canvas_peerids (peerid, topic) VALUES ($1, $2)", [encoded, location.topic])
		await client.end()
		return newPeerId
	} else {
		// create peer id on disk
		assert(typeof location.path === "string", 'expected typeof location.path === "string"')

		const peerIdPath = path.resolve(location.path, PEER_ID_FILENAME)
		if (fs.existsSync(peerIdPath)) {
			return await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64"))
		}

		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, Buffer.from(exportToProtobuf(peerId)).toString("base64"))
		return peerId
	}
}
