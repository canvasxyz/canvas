import path from "node:path"
import fs from "node:fs"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLog as MemoryGossipLog } from "@canvas-js/gossiplog/memory"
import { ModelDB } from "@canvas-js/modeldb/node"

import type { PlatformTarget } from "../interface.js"
import { assert } from "../../utils.js"
import { getLibp2pOptions } from "./libp2p.js"

const PEER_ID_FILENAME = ".peer-id"

export default function getTarget(location: string | null): PlatformTarget {
	return {
		async getPeerId(): Promise<PeerId> {
			if (process.env.PEER_ID !== undefined) {
				return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
			}

			if (location === null) {
				const peerId = await createEd25519PeerId()
				console.log(`[canvas-core] Using temporary PeerId ${peerId}`)
				return peerId
			}

			const peerIdPath = path.resolve(location, PEER_ID_FILENAME)
			if (fs.existsSync(peerIdPath)) {
				const peerId = await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64"))
				console.log(`[canvas-core] Found existing PeerID ${peerId}`)
				return peerId
			}

			console.log(`[canvas-core] Creating new PeerID at ${peerIdPath}`)
			const peerId = await createEd25519PeerId()
			fs.writeFileSync(peerIdPath, Buffer.from(exportToProtobuf(peerId)).toString("base64"))
			return peerId
		},

		async openDB(name, models, { indexHistory } = {}) {
			if (location === null) {
				return new ModelDB({ path: null, models, indexHistory })
			} else {
				assert(/[a-zA-Z]+/.test(name))
				return new ModelDB({ path: path.resolve(location, `${name}.sqlite`), models, indexHistory })
			}
		},

		openGossipLog: <Payload, Result>(init: GossipLogInit<Payload, Result>) =>
			location === null
				? MemoryGossipLog.open(init)
				: GossipLog.open(path.resolve(location, "topics", init.topic), init),

		createLibp2p: (config, peerId) => createLibp2p(getLibp2pOptions(peerId, config)),
	}
}
