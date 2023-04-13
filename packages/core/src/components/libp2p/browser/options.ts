import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex as hex } from "@noble/hashes/utils"
import { ethers } from "ethers"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { peerIdFromString } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"

import { PEER_ID_FILENAME, minute, second } from "@canvas-js/core/constants"
import { assert } from "@canvas-js/core/utils"

import { defaultBootstrapList } from "../bootstrap.js"
import chalk from "chalk"

const { base64 } = ethers.utils

export async function getLibp2pOptions(config: {
	peerId: PeerId
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const announce = bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${config.peerId}`)
	for (const address of announce) {
		console.log(chalk.gray(`[canvas-core] Announcing on ${address}`))
	}

	const listen = bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit`)
	for (const address of listen) {
		console.log(chalk.gray(`[canvas-core] Listening on ${address}`))
	}

	return {
		peerId: config.peerId,
		addresses: { listen: [], announce },
		transports: [webSockets(), circuitRelayTransport({ discoverRelays: bootstrapList.length })],
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
			msgIdToStrFn: (id) => hex(id),
			directPeers: bootstrapList.map((address) => {
				const ma = multiaddr(address)
				const peerId = ma.getPeerId()

				if (peerId === null) {
					throw new Error("Invalid bootstrap peer address: must identify peer id using /p2p")
				}

				return { id: peerIdFromString(peerId), addrs: [ma] }
			}),
		}),
		ping: {
			protocolPrefix: "/canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: 20 * second,
		},
	}
}

export async function getPeerId(directory: string | null): Promise<PeerId> {
	assert(directory !== null)

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
