import path from "node:path"
import fs from "node:fs"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"
import { base32 } from "multiformats/bases/base32"
import { blake3 } from "@noble/hashes/blake3"
import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { register } from "prom-client"

import { ModelDB } from "@canvas-js/modeldb-sqlite"
import { NodeStore } from "@canvas-js/store/node"
import { MemoryStore } from "@canvas-js/store/memory"

import type { PlatformTarget } from "../interface.js"
import { MST_DIRECTORY_NAME } from "../../constants.js"

const PEER_ID_FILENAME = ".peer-id"

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

		async openDB(name, init, options) {
			if (location === null) {
				return new ModelDB(null, init, options)
			} else {
				const hash = base32.baseEncode(blake3(name, { dkLen: 10 }))
				const dbPath = path.resolve(location, `models-${hash}.sqlite`)
				return new ModelDB(dbPath, init)
			}
		},

		async openStore(init) {
			if (location === null) {
				return await MemoryStore.open(init)
			} else {
				return await NodeStore.open(path.resolve(location, MST_DIRECTORY_NAME), init)
			}
		},

		extendLibp2pOptions(options) {
			return { ...options, metrics: prometheusMetrics({ registry: register }) }
		},
	}
}
