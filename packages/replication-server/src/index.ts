import fs from "node:fs"
import path from "node:path"

import { createLibp2p } from "libp2p"
import PQueue from "p-queue"

import { topicPattern } from "@canvas-js/gossiplog"
import { GossipLogService } from "@canvas-js/gossiplog/service"
import { Canvas } from "@canvas-js/core"

import { options } from "./libp2p.js"
import { dataDirectory, discoveryTopic } from "./config.js"

const apps = new Map<string, Canvas>()

const queue = new PQueue({ concurrency: 1 })

const libp2p = await createLibp2p(options)

libp2p.addEventListener("connection:open", ({ detail: connection }) => {
	const addr = connection.remoteAddr.decapsulateCode(421).toString()
	console.log(`[replication-server] opened connection ${connection.id} to ${connection.remotePeer} on ${addr}`)
})

libp2p.addEventListener("connection:close", ({ detail: connection }) => {
	console.log(`[replication-server] closed connection ${connection.id} to ${connection.remotePeer}`)
})

libp2p.services.discovery.addEventListener("peer:topics", ({ detail: { topics } }) => {
	for (const topic of topics) {
		if (!topic.startsWith(GossipLogService.topicPrefix)) {
			continue
		}

		const appTopic = topic.slice(GossipLogService.topicPrefix.length)
		if (!topicPattern.test(appTopic)) {
			console.error("[replication-server] received invalid topic", topic)
			continue
		}

		queue.add(async () => {
			if (apps.has(appTopic)) {
				return
			}

			console.log(`[replication-server] Starting app ${appTopic}`)

			const directory = path.resolve(dataDirectory, appTopic)
			if (!fs.existsSync(directory)) {
				console.log("[replication-server] Creating app directory at", directory)
				fs.mkdirSync(directory, { recursive: true })
			}

			const app = await Canvas.initialize({
				path: directory,
				contract: { topic: appTopic, models: {}, actions: {} },
				libp2p,
				indexHistory: false,
				ignoreMissingActions: true,
			})

			apps.set(appTopic, app)
		})
	}
})

await libp2p.start()

console.log("[replication-server] started libp2p with PeerId", libp2p.peerId.toString())
console.log(
	"[replication-server] listening on",
	libp2p.getMultiaddrs().map((addr) => addr.toString()),
)

console.log("[replication-server] subscribed to discovery topic", discoveryTopic)

process.on("SIGINT", async () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	await libp2p.stop()
	await Promise.all(Array.from(apps.values()).map((app) => app.close()))
	apps.clear()
})
