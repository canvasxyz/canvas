import type { PeerId } from "@libp2p/interface"
import { createLibp2p } from "libp2p"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { base64 } from "multiformats/bases/base64"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/browser"
import { ModelDB } from "@canvas-js/modeldb/idb"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

export default {
	openDB: ({ topic }, models, { indexHistory } = {}) =>
		ModelDB.initialize({ name: `canvas/${topic}/db`, models, indexHistory }),

	openGossipLog: <Payload, Result>({ topic }: { topic: string }, init: GossipLogInit<Payload, Result>) =>
		GossipLog.open(init),

	async createLibp2p(location, config) {
		const peerId = await getPeerId(location)
		return await createLibp2p(getLibp2pOptions(peerId, config))
	},
} satisfies PlatformTarget

async function getPeerId({ topic }: { topic: string }): Promise<PeerId> {
	const localStorageKey = `canvas/${topic}/peer-id`
	const item = localStorage.getItem(localStorageKey)
	let peerId: PeerId

	if (item === null) {
		peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		localStorage.setItem(localStorageKey, base64.baseEncode(privateKey))
	} else {
		peerId = await createFromProtobuf(base64.baseDecode(item))
	}

	return new Promise((resolve) => {
		navigator.locks.request(`canvas:libp2p-lock:${peerId.toString()}`, { ifAvailable: true }, async (lock) => {
			if (!lock) {
				peerId = await createEd25519PeerId()
			}
			resolve(peerId)
			return new Promise((resolve) => {}) // automatically released when the browser tab closes
		})
	})
}
