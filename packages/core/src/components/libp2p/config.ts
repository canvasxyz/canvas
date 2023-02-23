import { sha256 } from "@noble/hashes/sha256"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { Multiaddr } from "@multiformats/multiaddr"

import { toHex } from "@canvas-js/core/utils"
import { libp2pRegister } from "../../metrics.js"

const bootstrapList = [
	"/dns4/canvas-bootstrap-p0.fly.dev/tcp/4002/ws/p2p/12D3KooWP4DLJuVUKoThfzYugv8c326MuM2Tx38ybvEyDjLQkE2o",
	"/dns4/canvas-bootstrap-p1.fly.dev/tcp/4002/ws/p2p/12D3KooWRftkCBMtYou4pM3VKdqkKVDAsWXnc8NabUNzx7gp7cPT",
	"/dns4/canvas-bootstrap-p2.fly.dev/tcp/4002/ws/p2p/12D3KooWPopNdRnzswSd8oVxrUBKGhgKzkYALETK7EHkToy7DKk3",
]

const announceFilter = (multiaddrs: Multiaddr[]) =>
	multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const denyDialMultiaddr = async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr)

const second = 1000
const minute = 60 * second

export function getLibp2pInit(config: {
	peerId: PeerId
	port?: number
	announce?: string[]
	bootstrap?: string[]
}): Libp2pOptions {
	const announceAddresses =
		config.announce ?? bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${config.peerId.toString()}`)

	const listenAddresses: string[] = []
	if (config.port !== undefined) {
		listenAddresses.push(`/ip4/0.0.0.0/tcp/${config.port}/ws`)
	}

	return {
		connectionGater: { denyDialMultiaddr },
		peerId: config.peerId,
		addresses: { listen: listenAddresses, announce: announceAddresses, announceFilter },
		transports: [webSockets()],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: config.bootstrap ?? bootstrapList })],
		dht: kadDHT({
			protocolPrefix: "/canvas",
			clientMode: false,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		}),
		metrics: prometheusMetrics({ registry: libp2pRegister }),
		pubsub: gossipsub({
			emitSelf: false,
			doPX: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => sha256(msg.data),
			msgIdToStrFn: (id) => toHex(id),
			fastMsgIdFn: (msg) => "0x" + sha256(msg.data ?? ""),
		}),
	}
}
