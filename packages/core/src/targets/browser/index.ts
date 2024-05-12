import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId, Ed25519PeerId } from "@libp2p/interface"
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

	openGossipLog: <Payload, Result>({ topic }: { topic: string }, init: GossipLogInit<Payload, Result>) =>
		GossipLog.open(init),

	async createLibp2p(location, config) {
		const peerId = await getPeerId(location)
		const libp2p = await createLibp2p(getLibp2pOptions(peerId, location.topic, config))

		// Patch autoDialPeerRetryThresholdms because it isn't passed to the dialer component.
		// This is safe to do because the threshold is checked on every autodial attempt.
		// The configuration option is fixed on master but it hasn't been released yet.

		// @ts-expect-error TS2339: Property 'components' does not exist
		libp2p.components.components.connectionManager.autoDial.autoDialPeerRetryThresholdMs = 1000
		return libp2p
	},
} satisfies PlatformTarget

async function getPeerId({ topic }: { topic: string }): Promise<PeerId> {
	const localStorageKey = `canvas/${topic}/peer-id`
	const item = localStorage.getItem(localStorageKey)
	let peerId: PeerId

	if (item === null) {
		peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId as Ed25519PeerId)
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
