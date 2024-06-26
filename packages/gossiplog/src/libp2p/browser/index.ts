import { createLibp2p } from "libp2p"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { all } from "@libp2p/websockets/filters"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { webRTC } from "@libp2p/webrtc"

import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"
import { Fetch, fetch } from "@libp2p/fetch"
import { ping } from "@libp2p/ping"

import { peerIdFromBytes, peerIdFromString } from "@libp2p/peer-id"
import { createEd25519PeerId, exportToProtobuf, createFromProtobuf } from "@libp2p/peer-id-factory"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import * as cbor from "@ipld/dag-cbor"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap, NetworkConfig } from "../../interface.js"
import { fromString, toString } from "uint8arrays"
import { PeerId } from "@libp2p/interface"

export const defaultRelayServer =
	"/dns4/canvas-relay-server.fly.dev/tcp/443/wss/p2p/12D3KooWLR64DxxPcW1vA6uyC74RYHEsoHwJEmCJRavTihLYmBZN"

type TopicPeerRecord = {
	id: Uint8Array
	addresses: Uint8Array[]
	protocols: string[]
	peerRecordEnvelope: Uint8Array | null
}

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

export async function getLibp2p<Payload>(config: NetworkConfig, messageLog: AbstractGossipLog<Payload>) {
	const peerId = await getPeerId(messageLog.topic)

	if (typeof localStorage.peerId === "string") console.log("using PeerId", peerId.toString())

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

	const libp2p = await createLibp2p<ServiceMap<Payload> & { fetch: Fetch }>({
		start: false,
		peerId: peerId,
		addresses: { listen, announce },
		transports: [
			webSockets({ filter: all }),
			webRTC({ rtcConfiguration: { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] } }),
			circuitRelayTransport({ discoverRelays: 1 }),
		],

		connectionGater: { denyDialMultiaddr: (addr: Multiaddr) => false },

		connectionManager: {
			minConnections: config.minConnections,
			maxConnections: config.maxConnections,
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
				scoreParams: {
					IPColocationFactorWeight: 0,
				},
			}),

			gossiplog: gossiplog(messageLog, {}),
		},
	})

	libp2p.addEventListener("connection:open", ({ detail: { direction, remotePeer, remoteAddr } }) => {
		// console.log(`connection:open ${direction} ${remotePeer} ${remoteAddr}`)
		if (relayServerPeerId === remotePeer.toString()) {
			console.log(`[fetch ${relayServerPeerId}]`)
			libp2p.services.fetch.fetch(peerIdFromString(relayServerPeerId), `canvas/v1/${messageLog.topic}`).then(
				async (result) => {
					const results = cbor.decode<TopicPeerRecord[]>(result ?? cbor.encode([]))
					console.log(`[fetch ${relayServerPeerId}] got ${results.length} results`)
					for (const { id, addresses, protocols, peerRecordEnvelope } of results) {
						const peerId = peerIdFromBytes(id)
						if (peerId.equals(libp2p.peerId)) {
							continue
						}

						await libp2p.peerStore.save(peerId, {
							addresses: addresses.map((addr) => ({ isCertified: true, multiaddr: multiaddr(addr) })),
							protocols: protocols,
							peerRecordEnvelope: peerRecordEnvelope ?? undefined,
						})

						console.log(`[fetch ${relayServerPeerId}] dialing ${peerId}`)

						libp2p.dial(peerId)
					}
				},
				(err) => console.log("fetch failed", err),
			)

			return
		}
	})

	return libp2p
}
