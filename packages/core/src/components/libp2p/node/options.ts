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
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { Multiaddr } from "@multiformats/multiaddr"

import { toHex } from "@canvas-js/core/utils"
import { libp2pRegister } from "../../../metrics.js"

import { defaultBootstrapList } from "../bootstrap.js"

const announceFilter = (multiaddrs: Multiaddr[]) =>
	multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const denyDialMultiaddr = async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr)

const second = 1000
const minute = 60 * second

export async function getLibp2pOptions(config: {
	peerId?: PeerId
	port?: number
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	const peerId = config.peerId ? config.peerId : await createEd25519PeerId()

	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const announceAddresses =
		config.announce ?? bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${peerId}`)

	const listenAddresses: string[] = []
	if (config.port !== undefined) {
		listenAddresses.push(`/ip4/0.0.0.0/tcp/${config.port}/ws`)
	}

	return {
		connectionGater: { denyDialMultiaddr },
		peerId: peerId,
		addresses: { listen: listenAddresses, announce: announceAddresses, announceFilter },
		transports: [webSockets()],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
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
		}),
	}
}
