import path from "node:path"
import fs from "node:fs"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex as hex } from "@noble/hashes/utils"

import chalk from "chalk"

import { register } from "prom-client"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { peerIdFromString } from "@libp2p/peer-id"
import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { circuitRelayTransport } from "libp2p/circuit-relay"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { defaultBootstrapList } from "@canvas-js/core/bootstrap"
import {
	DIAL_CONCURRENCY,
	DIAL_CONCURRENCY_PER_PEER,
	MIN_CONNECTIONS,
	PEER_ID_FILENAME,
	minute,
	second,
} from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"

async function denyDialMultiaddr(multiaddr: Multiaddr) {
	const transportRoot = multiaddr.decapsulate("/ws")
	return transportRoot.isThinWaistAddress() && isLoopback(transportRoot)
}

export async function getLibp2pOptions(config: P2PConfig): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const directPeers: { id: PeerId; addrs: Multiaddr[] }[] = []
	for (const address of bootstrapList) {
		const addr = multiaddr(address)
		const bootstrapPeerId = addr.getPeerId()
		if (bootstrapPeerId === null) {
			throw new Error("bootstrap address must include peer id")
		}

		directPeers.push({ id: peerIdFromString(bootstrapPeerId), addrs: [addr] })
	}

	if (config.listen === undefined) {
		console.log(`[canvas-core] No --listen address provided. Using bootstrap servers as public relays.`)
	}

	const discoverRelays = config.announce ? 0 : bootstrapList.length

	const announce = config.announce ?? []
	for (const address of announce) {
		console.log(chalk.gray(`[canvas-core] Announcing on ${address}`))
	}

	const listen = config.listen ?? []
	for (const address of listen) {
		console.log(chalk.gray(`[canvas-core] Listening on ${address}`))
	}

	const options: Libp2pOptions = {
		peerId: config.peerId,
		addresses: { listen, announce },

		connectionGater: { denyDialMultiaddr },
		connectionManager: {
			minConnections: MIN_CONNECTIONS,
			autoDialConcurrency: DIAL_CONCURRENCY,
			maxParallelDialsPerPeer: DIAL_CONCURRENCY_PER_PEER,
		},

		transports: [webSockets(), circuitRelayTransport({ discoverRelays })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],

		metrics: prometheusMetrics({ registry: register }),

		pubsub: gossipsub({
			directPeers,
			emitSelf: false,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => sha256(msg.data),
			msgIdToStrFn: (id) => hex(id),
		}),

		ping: {
			protocolPrefix: "canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: 20 * second,
		},
	}

	if (config.disableDHT) {
		console.log(`[canvas-core] Disabling DHT`)
	} else {
		options.dht = kadDHT({
			protocolPrefix: "/canvas",
			clientMode: announce.length === 0,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		})
	}

	return options
}

export async function getPeerId(directory: string | null): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	if (directory === null) {
		const peerId = await createEd25519PeerId()
		console.log(`[canvas-core] Using temporary PeerId ${peerId}`)
		return peerId
	}

	const peerIdPath = path.resolve(directory, PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		const peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
		return peerId
	} else {
		console.log(`[canvas-core] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}
