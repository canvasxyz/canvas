import { createLibp2p } from "libp2p"
import { PeerId } from "@libp2p/interface"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"

import { fetch } from "@libp2p/fetch"
import { ping } from "@libp2p/ping"

import { createEd25519PeerId, exportToProtobuf, createFromProtobuf } from "@libp2p/peer-id-factory"

import { fromString, toString } from "uint8arrays"
import { Multiaddr } from "@multiformats/multiaddr"

import { discovery } from "@canvas-js/discovery"

import type { ServiceMap, NetworkConfig } from "../../interface.js"
import { second } from "../../constants.js"

export async function getPeerId(topic?: string): Promise<PeerId> {
	if (topic === undefined) {
		return await createEd25519PeerId()
	}

	const peerIdKey = `canvas/v1/${topic}/peer-id`
	const peerIdRecord = localStorage.getItem(peerIdKey)
	if (peerIdRecord !== null) {
		try {
			return await createFromProtobuf(fromString(peerIdRecord, "base64"))
		} catch (err) {
			console.error(err)
		}
	}

	const peerId = await createEd25519PeerId()
	localStorage.setItem(peerIdKey, toString(exportToProtobuf(peerId), "base64"))
	return peerId
}

export async function getLibp2p(config: NetworkConfig) {
	let peerId = config.peerId
	if (peerId === undefined) {
		peerId = await getPeerId(config.topic)
	}

	console.log("using PeerId", peerId.toString())

	const bootstrapList = config.bootstrapList ?? []

	const listen: string[] = []
	const announce: string[] = []

	console.log("listening on", listen)
	console.log("announcing on", announce)

	const libp2p = await createLibp2p<ServiceMap>({
		peerId: peerId,
		start: config.start ?? false,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all })],

		connectionGater: { denyDialMultiaddr: (addr: Multiaddr) => false },

		connectionManager: {
			minConnections: config.minConnections,
			maxConnections: config.maxConnections,
			dialTimeout: 10 * second,
			autoDialPeerRetryThreshold: 10 * second,
		},

		connectionMonitor: { protocolPrefix: "canvas" },

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux({})],
		connectionEncryption: [noise({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			fetch: fetch({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),
			discovery: discovery({}),
		},
	})

	return libp2p
}
