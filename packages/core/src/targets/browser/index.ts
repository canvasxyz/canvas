import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { Ed25519PeerId, PeerId } from "@libp2p/interface"
import { base64 } from "multiformats/bases/base64"
import { createLibp2p } from "libp2p"

import { GossipLogInit } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/browser"
import { ModelDB } from "@canvas-js/modeldb/idb"

import type { PlatformTarget } from "../interface.js"
import { getLibp2pOptions } from "./libp2p.js"

export default {
	openDB: ({ topic }, models, { indexHistory } = {}) =>
		ModelDB.initialize({ name: `canvas/${topic}/db`, models, indexHistory }),

	openGossipLog: <Payload>({ topic }: { topic: string }, init: GossipLogInit<Payload>) => GossipLog.open(init),

	async createLibp2p(location, config) {
		const peerId = await getPeerId(location)
		return await createLibp2p(getLibp2pOptions(peerId, location.topic, config))
	},
} satisfies PlatformTarget

async function getPeerId({ topic }: { topic: string }): Promise<PeerId> {
	const localStorageKey = `canvas/${topic}/peer-id`
	const item = localStorage.getItem(localStorageKey)
	let peerId: PeerId

	if (item === null) {
		const ed25519PeerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(ed25519PeerId as Ed25519PeerId)
		localStorage.setItem(localStorageKey, base64.baseEncode(privateKey))
		peerId = ed25519PeerId
	} else {
		peerId = await createFromProtobuf(base64.baseDecode(item))
	}

	return new Promise((resolve) => {
		navigator.locks.request(`canvas:libp2p-lock:${peerId.toString()}`, { ifAvailable: true }, async (lock) => {
			if (!lock) {
				peerId = await createEd25519PeerId()
			}
			resolve(peerId)
			return new Promise((resolve) => { }) // automatically released when the browser tab closes
		})
	})
}
