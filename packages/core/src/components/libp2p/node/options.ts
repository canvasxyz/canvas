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

import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { Multiaddr } from "@multiformats/multiaddr"

import { PEER_ID_FILENAME } from "@canvas-js/core/constants"
import { toHex } from "@canvas-js/core/utils"

import { libp2pRegister } from "../../../metrics.js"
import { defaultBootstrapList } from "../bootstrap.js"

const announceFilter = (multiaddrs: Multiaddr[]) =>
	multiaddrs.filter((multiaddr) => !isLoopback(multiaddr) && !isPrivate(multiaddr))

const denyDialMultiaddr = async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr)

const second = 1000
const minute = 60 * second

export async function getLibp2pOptions(config: {
	directory: string | null
	listen?: number
	announce?: string[]
	bootstrapList?: string[]
}): Promise<Libp2pOptions> {
	const peerId = await getPeerId(config.directory)

	const bootstrapList = config.bootstrapList ?? defaultBootstrapList

	const port = config.listen ? config.listen : await getRandomPort()

	const listenAddresses = [`/ip4/0.0.0.0/tcp/${port}/ws`]

	console.log(`[canvas-core] Listening on`, listenAddresses)

	const announceAddresses =
		config.announce ?? bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${peerId}`)

	console.log(`[canvas-core] Announcing on`, announceAddresses)

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

async function getPeerId(directory: string | null): Promise<PeerId> {
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

async function getRandomPort() {
	const server = net.createServer()

	const port = await new Promise((resolve, reject) =>
		server.listen(0, () => {
			const address = server.address()
			if (address === null || typeof address == "string") {
				reject(new Error("unexpected net.server address"))
			} else {
				resolve(address.port)
			}
		})
	)

	await new Promise<void>((resolve, reject) =>
		server.close((err) => {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	)

	return port
}
