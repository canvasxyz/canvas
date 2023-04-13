import path from "node:path"
import fs from "node:fs"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex as hex } from "@noble/hashes/utils"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import { peerIdFromString } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { circuitRelayTransport } from "libp2p/circuit-relay"

import { register } from "prom-client"

import { PEER_ID_FILENAME, minute, second } from "@canvas-js/core/constants"

import { defaultBootstrapList } from "../bootstrap.js"
import chalk from "chalk"

export async function getLibp2pOptions(config: {
	peerId: PeerId
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

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

	return {
		peerId: config.peerId,
		addresses: { listen, announce },
		transports: [webSockets(), circuitRelayTransport({ discoverRelays })],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
		dht: kadDHT({
			protocolPrefix: "/canvas",
			clientMode: false,
			providers: { provideValidity: 20 * minute, cleanupInterval: 5 * minute },
		}),
		metrics: prometheusMetrics({ registry: register }),
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
			protocolPrefix: "canvas",
			maxInboundStreams: 32,
			maxOutboundStreams: 32,
			timeout: 20 * second,
		},
	}
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
