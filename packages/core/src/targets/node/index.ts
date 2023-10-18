import path from "node:path"
import fs from "node:fs"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLog as MemoryGossipLog } from "@canvas-js/gossiplog/memory"
import { ModelDB } from "@canvas-js/modeldb/sqlite"

import type { PlatformTarget } from "../interface.js"
import { assert } from "../../utils.js"
import { getLibp2pOptions } from "./libp2p.js"

const PEER_ID_FILENAME = ".peer-id"

export default {
	async getPeerId(location): Promise<PeerId> {
		if (process.env.PEER_ID !== undefined) {
			return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
		}

		if (location === null) {
			return await createEd25519PeerId()
		}

		const peerIdPath = path.resolve(location, PEER_ID_FILENAME)
		if (fs.existsSync(peerIdPath)) {
			return await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64"))
		}

		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, Buffer.from(exportToProtobuf(peerId)).toString("base64"))
		return peerId
	},

	async openDB(location, name, models, { indexHistory } = {}) {
		if (location === null) {
			return new ModelDB({ path: null, models, indexHistory })
		} else {
			assert(/[a-zA-Z]+/.test(name))
			return new ModelDB({ path: path.resolve(location, `${name}.sqlite`), models, indexHistory })
		}
	},

	async openGossipLog<Payload, Result>(location: string | null, init: GossipLogInit<Payload, Result>) {
		if (location === null) {
			return await MemoryGossipLog.open(init)
		} else {
			return await GossipLog.open(path.resolve(location, "topics", init.topic), init)
		}
	},

	createLibp2p: (peerId, options) => createLibp2p(getLibp2pOptions(peerId, options)),
} satisfies PlatformTarget
