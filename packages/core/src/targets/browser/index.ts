import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { base64 } from "multiformats/bases/base64"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/browser"
import { ModelDB } from "@canvas-js/modeldb/idb"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

export default {
	async getPeerId(location): Promise<PeerId> {
		if (location === null) {
			const peerId = await createEd25519PeerId()
			console.log(`[canvas-core] Using temporary PeerId ${peerId}`)
			return peerId
		}

		const localStorageKey = `canvas:${location}/peer-id`
		const item = localStorage.getItem(localStorageKey)
		if (item === null) {
			const peerId = await createEd25519PeerId()
			const privateKey = exportToProtobuf(peerId)
			localStorage.setItem(localStorageKey, base64.baseEncode(privateKey))
			console.log(`[canvas-core] Created new PeerId ${peerId}`)
			return peerId
		} else {
			const peerId = await createFromProtobuf(base64.baseDecode(item))
			console.log(`[canvas-core] Found existing PeerId ${peerId}`)
			return peerId
		}
	},

	openDB: (location, name, models, { indexHistory } = {}) =>
		ModelDB.initialize({ name: `${location}/${name}`, models, indexHistory }),

	openGossipLog: <Payload, Result>(location: string | null, init: GossipLogInit<Payload, Result>) =>
		GossipLog.open(`${location}/topics/${init.topic}`, init),

	createLibp2p: (config, peerId) => createLibp2p(getLibp2pOptions(config, peerId)),
} satisfies PlatformTarget
