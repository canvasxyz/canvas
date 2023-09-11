import path from "node:path"
import fs from "node:fs"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { register } from "prom-client"

import { ModelDB } from "@canvas-js/modeldb/node"

import type { PlatformTarget } from "../interface.js"

const PEER_ID_FILENAME = ".peer-id"
const DB_FILENAME = "db.sqlite"

export default function getTarget(location: string | null): PlatformTarget {
	return {
		async getPeerId(): Promise<PeerId> {
			if (process.env.PEER_ID !== undefined) {
				return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
			}

			if (location === null) {
				const peerId = await createEd25519PeerId()
				// console.log(`[canvas-core] Using temporary PeerId ${peerId}`)
				return peerId
			}

			const peerIdPath = path.resolve(location, PEER_ID_FILENAME)
			if (fs.existsSync(peerIdPath)) {
				return await createFromProtobuf(Buffer.from(fs.readFileSync(peerIdPath, "utf-8"), "base64"))
			}

			// console.log(`[canvas-core] Creating new PeerID at ${peerIdPath}`)
			const peerId = await createEd25519PeerId()
			fs.writeFileSync(peerIdPath, Buffer.from(exportToProtobuf(peerId)).toString("base64"))
			return peerId
		},

		async openDB(init, options) {
			if (location === null) {
				return new ModelDB(null, init, options)
			} else {
				return new ModelDB(path.resolve(location, DB_FILENAME), init)
			}
		},

		extendLibp2pOptions(options) {
			return { ...options, metrics: prometheusMetrics({ registry: register }) }
		},
	}
}
