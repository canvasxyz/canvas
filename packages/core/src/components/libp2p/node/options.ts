import path from "node:path"
import fs from "node:fs"

import { register } from "prom-client"

import type { Libp2pOptions } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"

import { PEER_ID_FILENAME } from "@canvas-js/core/constants"

import type { P2PConfig } from "../types.js"
import { getBaseLibp2pOptions } from "../options.js"

export async function getLibp2pOptions(peerId: PeerId, config: P2PConfig): Promise<Libp2pOptions> {
	return {
		...getBaseLibp2pOptions(peerId, config),
		metrics: prometheusMetrics({ registry: register }),
	}
}

export async function getPeerId(directory: string | null): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	if (directory === null) {
		const peerId = await createEd25519PeerId()
		console.log(`[canvas-core] [p2p] Using temporary PeerId ${peerId}`)
		return peerId
	}

	const peerIdPath = path.resolve(directory, PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		const peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
		return peerId
	} else {
		console.log(`[canvas-core] [p2p] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}
