import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { sha256 } from "@noble/hashes/sha256"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"

import { ethers } from "ethers"

import { PEER_ID_FILENAME, minute } from "@canvas-js/core/constants"
import { toHex, assert } from "@canvas-js/core/utils"

import { defaultBootstrapList } from "../bootstrap.js"

const { base64 } = ethers.utils

export async function getLibp2pOptions(config: {
	directory: string | null
	listen?: number
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	assert(config.directory !== null)
	const peerId = await getPeerId(config.directory)
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	if (config.announce !== undefined && config.announce.length > 0) {
		throw new Error("Cannot announce in the browser")
	}

	const announceAddresses = bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${peerId}`)
	console.log(`[canvas-core] Using bootstrap servers as public relays`)

	return {
		peerId: peerId,
		addresses: { listen: [], announce: announceAddresses },
		transports: [webSockets()],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
		dht: kadDHT({
			protocolPrefix: "/canvas",
			clientMode: true,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		}),
		pubsub: gossipsub({
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => sha256(msg.data),
			msgIdToStrFn: (id) => toHex(id),
		}),
	}
}

async function getPeerId(directory: string): Promise<PeerId> {
	const localStorageKey = `canvas:${directory}/${PEER_ID_FILENAME}`
	const item = localStorage.getItem(localStorageKey)
	if (item === null) {
		const peerId = await createEd25519PeerId()
		const privateKey = exportToProtobuf(peerId)
		localStorage.setItem(localStorageKey, base64.encode(privateKey))
		console.log(`[canvas-core] Created new peer id ${peerId}`)
		return peerId
	} else {
		const peerId = await createFromProtobuf(base64.decode(item))
		console.log(`[canvas-core] Found existing peer id ${peerId}`)
		return peerId
	}
}
