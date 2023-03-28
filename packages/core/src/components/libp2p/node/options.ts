import path from "node:path"
import net from "node:net"
import fs from "node:fs"

import { sha256 } from "@noble/hashes/sha256"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"
import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from "@libp2p/kad-dht"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { register } from "prom-client"

import { PEER_ID_FILENAME, minute } from "@canvas-js/core/constants"
import { toHex } from "@canvas-js/core/utils"

import { defaultBootstrapList } from "../bootstrap.js"

export async function getLibp2pOptions(config: {
	peerId: PeerId
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const listen = config.listen ?? [`/ip4/0.0.0.0/tcp/${await getRandomPort()}/ws`]

	console.log(`[canvas-core] Listening on [ ${listen.join(", ")} ]`)

	const announce = config.announce ?? bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${config.peerId}`)

	if (config.announce !== undefined) {
		if (config.announce.length > 0) {
			console.log(`[canvas-core] Announcing on public addresses [ ${config.announce.join(", ")} ]`)
		}
	} else {
		console.log(`[canvas-core] No --announce address provided. Using bootstrap servers as public relays.`)
	}

	return {
		peerId: config.peerId,
		addresses: { listen, announce },
		transports: [webSockets()],
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
			doPX: true,
			canRelayMessage: true,
			fallbackToFloodsub: false,
			allowPublishToZeroPeers: true,
			globalSignaturePolicy: "StrictSign",
			msgIdFn: (msg) => sha256(msg.data),
			msgIdToStrFn: (id) => toHex(id),
		}),
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
		console.log(`[canvas-core] Using PeerId ${peerId}`)
		return peerId
	} else {
		console.log(`[canvas-core] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		console.log(`[canvas-core] Using PeerId ${peerId}`)
		return peerId
	}
}

function getRandomPort(): Promise<number> {
	const server = net.createServer()
	return new Promise((resolve, reject) =>
		server.listen(0, () => {
			const address = server.address()
			if (address === null || typeof address == "string") {
				server.close()
				reject(new Error("unexpected net.server address"))
			} else {
				server.close((err) => (err ? reject(err) : resolve(address.port)))
			}
		})
	)
}
