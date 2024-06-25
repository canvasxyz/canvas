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
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import * as cbor from "@ipld/dag-cbor"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { gossiplog } from "@canvas-js/gossiplog/service"

import type { ServiceMap, NetworkConfig } from "../../interface.js"

export const defaultRelayServer =
	"/dns4/canvas-relay-server-thrumming-surf-3764.fly.dev/tcp/443/wss/p2p/12D3KooWFfrssaGYVeMQxzQoSPcr7go8uHe2grkSkr3b99Ky1M7R"

type TopicPeerRecord = {
	id: Uint8Array
	addresses: Uint8Array[]
	protocols: string[]
	peerRecordEnvelope: Uint8Array | null
}

export async function getLibp2p<Payload>(config: NetworkConfig, messageLog: AbstractGossipLog<Payload>) {
	const peerId = await createEd25519PeerId()
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

	const libp2p = await createLibp2p<ServiceMap<Payload> & { fetch: Fetch }>({
		start: false,
		peerId: peerId,
		addresses: { listen, announce },
		transports: [webSockets({ filter: all }), webRTC({}), circuitRelayTransport({ discoverRelays: 1 })],
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
			libp2p.services.fetch.fetch(peerIdFromString(relayServerPeerId), `topic/${messageLog.topic}`).then(
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
