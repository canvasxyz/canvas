import path from "node:path"
import fs from "node:fs"

import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { PeerId } from "@libp2p/interface-peer-id"

import { prometheusMetrics } from "@libp2p/prometheus-metrics"
import { register } from "prom-client"

import { MessageLogInit } from "@canvas-js/gossiplog"
import { MessageLog } from "@canvas-js/gossiplog/node"
import { MessageLog as MemoryMessageLog } from "@canvas-js/gossiplog/memory"
import { ModelDB } from "@canvas-js/modeldb/node"

import type { PlatformTarget } from "../interface.js"
import { assert } from "../../utils.js"

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

		async openDB(name: string, init, options) {
			if (location === null) {
				return new ModelDB(null, init, options)
			} else {
				assert(/[a-zA-Z]+/.test(name))
				return new ModelDB(path.resolve(location, `${name}.sqlite`), init, options)
			}
		},

		openMessageLog: <Payload, Result>(init: MessageLogInit<Payload, Result>) =>
			location === null
				? MemoryMessageLog.open(init)
				: MessageLog.open(path.resolve(location, "topics", init.topic), init),

		extendLibp2pOptions(options) {
			return { ...options, metrics: prometheusMetrics({ registry: register }) }
		},
	}
}
