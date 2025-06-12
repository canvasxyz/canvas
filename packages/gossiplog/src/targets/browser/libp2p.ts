import { createLibp2p } from "libp2p"
import { Libp2p, MultiaddrConnection, PeerId } from "@libp2p/interface"
import { identify } from "@libp2p/identify"
import { webSockets } from "@libp2p/websockets"
import { yamux } from "@chainsafe/libp2p-yamux"
import { noise } from "@chainsafe/libp2p-noise"
import { KadDHT, kadDHT } from "@libp2p/kad-dht"
import { ping } from "@libp2p/ping"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2"
import { webRTC } from "@libp2p/webrtc"
import { bootstrap } from "@libp2p/bootstrap"

// import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { multiaddr, Multiaddr } from "@multiformats/multiaddr"
import { rendezvousClient } from "@canvas-js/libp2p-rendezvous/client"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { NetworkConfig, ServiceMap, gossipLogService } from "@canvas-js/gossiplog/libp2p"
import { defaultBootstrapList } from "@canvas-js/gossiplog/bootstrap"

import { getDHTProtocol } from "../../utils.js"
import { getPrivateKey } from "./privateKey.js"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha2"

const defaultStunServer = "stun:stun.l.google.com:19302"
const defaultTurnServer = "turn:canvas-turn-server.fly.dev:3478?transport=udp"
const defaultRelayServer =
	"/dns4/canvas-relay-server.fly.dev/tcp/443/wss/p2p/12D3KooWNTYgUGwnAeioNPfACrp1dK2gFLi5M1cyoREWF8963cqT"

// const defaultRelayServer =
// 	"/dns6/canvas-relay-server.internal/tcp/8080/ws/p2p/12D3KooWNTYgUGwnAeioNPfACrp1dK2gFLi5M1cyoREWF8963cqT"

export async function getLibp2p<Payload>(
	gossipLog: AbstractGossipLog<Payload>,
	config: NetworkConfig,
): Promise<Libp2p<ServiceMap<Payload>>> {
	let privateKey = config.privateKey
	if (privateKey === undefined) {
		privateKey = await getPrivateKey()
	}

	const relayServer = config.relayServer ?? defaultRelayServer
	// const relayServerPeerId = multiaddr(relayServer).getPeerId()

	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	// TODO: is this a good idea?
	// if (!bootstrapList.includes(relayServer)) {
	// 	bootstrapList.push(relayServer)
	// }

	const libp2p = await createLibp2p({
		privateKey: privateKey,
		start: config.start ?? true,
		addresses: {
			listen: ["/webrtc", "/p2p-circuit"],
			announce: [],
			announceFilter: (addrs) =>
				addrs.filter((addr) => addr.protoNames().slice(-3).join("/") === "p2p-circuit/webrtc/p2p"),
		},
		transports: [
			webSockets({}),
			circuitRelayTransport({}),
			webRTC({
				rtcConfiguration: {
					iceTransportPolicy: "all",
					iceServers: [
						{ urls: [defaultStunServer] },
						{
							urls: [defaultTurnServer],
							username: gossipLog.topic,
							credential: bytesToHex(sha256(gossipLog.topic)),
						},
					],
				},
			}),
		],

		connectionGater: {
			denyDialMultiaddr: config.denyDialMultiaddr ?? ((addr: Multiaddr) => false),
			denyInboundConnection: config.denyInboundConnection ?? ((maConn: MultiaddrConnection) => false),
		},

		connectionManager: {
			maxConnections: config.maxConnections,
			maxIncomingPendingConnections: 256,
			inboundConnectionThreshold: 16,
		},

		connectionMonitor: { enabled: true, protocolPrefix: "canvas" },

		peerDiscovery: [bootstrap({ list: [relayServer] })],

		streamMuxers: [yamux()],
		connectionEncrypters: [noise({})],

		services: {
			identify: identify({ protocolPrefix: "canvas" }),
			ping: ping({ protocolPrefix: "canvas" }),

			dht: kadDHT({
				protocol: getDHTProtocol(gossipLog.topic),
			}),

			pubsub: gossipsub({
				emitSelf: false,
				fallbackToFloodsub: false,
				allowPublishToZeroTopicPeers: true,
				globalSignaturePolicy: "StrictNoSign",
				asyncValidation: true,
				scoreParams: { IPColocationFactorWeight: 0 },
			}),

			gossipLog: gossipLogService({ gossipLog: gossipLog }),

			rendezvous: rendezvousClient({
				autoRegister: {
					multiaddrs: bootstrapList,
					namespaces: [gossipLog.topic],
				},
				autoDiscover: true,
			}),
		},
	})

	libp2p.addEventListener("start", () => {
		libp2p.services.dht.setMode("server").then(
			() => console.log("ENABLED DHT SERVER MODE"),
			(err) => console.error("FAILED TO ENABLE DHT SERVER MODE", err),
		)
	})

	libp2p.services.rendezvous.addEventListener("peer", ({ detail: peerInfo }) => {
		const dht = libp2p.services.dht as KadDHT & {
			routingTable: { size: number; add: (peerId: PeerId) => Promise<void> }
		}

		dht.routingTable.add(peerInfo.id)
	})

	return libp2p
}
