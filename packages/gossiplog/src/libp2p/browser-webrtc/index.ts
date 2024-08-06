import { createLibp2p } from "libp2p"
import { PeerId } from "@libp2p/interface"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { webRTC } from "@libp2p/webrtc"

import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"
import { fetch } from "@libp2p/fetch"
import { ping } from "@libp2p/ping"

import { peerIdFromString } from "@libp2p/peer-id"
import { createEd25519PeerId, exportToProtobuf, createFromProtobuf } from "@libp2p/peer-id-factory"

import { fromString, toString } from "uint8arrays"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"

import { discovery } from "@canvas-js/discovery"

import type { ServiceMap, NetworkConfig } from "../../interface.js"
import { second } from "../../constants.js"

export const defaultRelayServer =
	"/dns4/canvas-relay-server.fly.dev/tcp/443/wss/p2p/12D3KooWLR64DxxPcW1vA6uyC74RYHEsoHwJEmCJRavTihLYmBZN"

export const defaultTurnServer = "turn:canvas-turn-server.fly.dev:3478?transport=udp"
export const defaultStunServer = "stun:stun.l.google.com:19302"

async function getPeerId(topic: string): Promise<PeerId> {
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
	const peerId = await getPeerId(config.topic)

	console.log("using PeerId", peerId.toString())

	const bootstrapList = config.bootstrapList ?? []
	const relayServer = config.relayServer ?? defaultRelayServer
	const relayServerPeerId = multiaddr(relayServer).getPeerId()

	if (!bootstrapList.includes(relayServer)) {
		bootstrapList.push(relayServer)
	}

	const listen = ["/webrtc"]
	const announce: string[] = [`${relayServer}/p2p-circuit/webrtc/p2p/${peerId}`]

	console.log("listening on", listen)
	console.log("announcing on", announce)

	const libp2p = await createLibp2p<ServiceMap>({
		start: config.start ?? false,
		peerId: peerId,
		addresses: { listen, announce },
		transports: [
			webSockets({ filter: all }),
			webRTC({
				rtcConfiguration: {
					iceTransportPolicy: "all",
					iceServers: [
						{ urls: [defaultStunServer] },
						{
							urls: [defaultTurnServer],
							username: config.topic,
							credential: bytesToHex(sha256(config.topic)),
						},
					],
				},
			}),
			circuitRelayTransport({ discoverRelays: 1 }),
		],

		connectionGater: { denyDialMultiaddr: (addr: Multiaddr) => false },

		connectionManager: {
			minConnections: config.minConnections,
			maxConnections: config.maxConnections,
			dialTimeout: 20 * second,
		},

		peerDiscovery: bootstrapList.length > 0 ? [bootstrap({ list: bootstrapList })] : [],

		streamMuxers: [yamux({})],
		connectionEncryption: [noise({})],
		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			fetch: fetch({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				asyncValidation: true,
				scoreParams: { IPColocationFactorWeight: 0 },
			}),

			discovery: discovery({}),
		},
	})

	libp2p.addEventListener("connection:open", ({ detail: { remotePeer } }) => {
		if (relayServerPeerId === remotePeer.toString()) {
			console.log(`[fetch ${relayServerPeerId}]`)

			libp2p.services.discovery?.fetch(peerIdFromString(relayServerPeerId), config.topic).then(
				(peers) => {},
				(err) => console.log(`fetch failed: ${err}`),
			)

			return
		}
	})

	return libp2p
}
