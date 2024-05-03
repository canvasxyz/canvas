import fs from "node:fs"
import path from "node:path"

import { createLibp2p } from "libp2p"
import PQueue from "p-queue"
import client from "prom-client"

import { topicPattern } from "@canvas-js/gossiplog"
import { GossipLogService } from "@canvas-js/gossiplog/service"
import { Canvas } from "@canvas-js/core"

import { options } from "./libp2p.js"
import { port, metricsPort, restartAt, dataDirectory, discoveryTopic, maxTopics, sleepTimeout } from "./config.js"
import { getAPI, getMetricsAPI } from "./api.js"
import { initFinishedMatches } from "./indexer.js"

export const apps = new Map<string, Canvas>()
export const lastActive = new Map<string, number>()
export const bannedApps = new Set<string>()

const startQueue = new PQueue({ concurrency: 1, interval: 300, intervalCap: 1 })

const libp2p = await createLibp2p(options)

await initFinishedMatches()

const topicsGauge = new client.Gauge({
	name: "canvas_replication_server_topics",
	help: "canvas_replication_server_topics",
	collect() {
		this.set(apps.size)
	},
})
const restartErrorsGauge = new client.Gauge({
	name: "canvas_replication_server_restart_errors",
	help: "canvas_replication_server_restart_errors",
})

libp2p.addEventListener("connection:open", ({ detail: connection }) => {
	const addr = connection.remoteAddr.decapsulateCode(421).toString()
	console.log(`[replication-server] opened connection ${connection.id} to ${connection.remotePeer} on ${addr}`)
})

libp2p.addEventListener("connection:close", ({ detail: connection }) => {
	console.log(`[replication-server] closed connection ${connection.id} to ${connection.remotePeer}`)
})

libp2p.services.discovery.addEventListener("peer:topics", ({ detail: { topics, isUniversalReplication, peerId } }) => {
	if (isUniversalReplication) {
		return
	}

	for (const topic of topics) {
		if (!topic.startsWith(GossipLogService.topicPrefix)) {
			continue
		}

		const appTopic = topic.slice(GossipLogService.topicPrefix.length)
		if (!topicPattern.test(appTopic)) {
			console.error("[replication-server] received invalid topic", topic)
			continue
		}

		lastActive.set(appTopic, new Date().getTime())

		if (apps.size > maxTopics && !apps.has(appTopic)) {
			console.error(`[replication-server] Received topic ${topic} but over max topics: ${apps.size}/${maxTopics}`)
			return
		}

		startQueue.add(async () => {
			if (apps.has(appTopic)) {
				return
			}
			if (bannedApps.has(appTopic)) {
				// console.log(`[replication-server] Ignoring banned app ${appTopic} from ${peerId}`)
				return
			}

			console.log(`[replication-server] Starting app ${appTopic} from ${peerId}`)

			const directory = path.resolve(dataDirectory, appTopic)
			if (!fs.existsSync(directory)) {
				console.log("[replication-server] Creating app directory at", directory)
				fs.mkdirSync(directory, { recursive: true })
			}

			try {
				const app = await Canvas.initialize({
					path: directory,
					contract: { topic: appTopic, models: {}, actions: {} },
					libp2p,
					indexHistory: false,
					ignoreMissingActions: true,
					disablePing: true,
				})
				apps.set(appTopic, app)
				lastActive.set(appTopic, new Date().getTime())
			} catch (err) {
				console.log("[replication-server] ERROR:", err)
				restartErrorsGauge.inc()
			}
		})
	}
})

const resetTimer = setInterval(() => {
	for (const appTopic of apps.keys()) {
		const app = apps.get(appTopic)
		const lastActiveTime = lastActive.get(appTopic)

		if (lastActiveTime === undefined || app === undefined) {
			continue
		}

		if (lastActiveTime < new Date().getTime() - sleepTimeout) {
			console.log(`[replication-server] Stopping app ${appTopic} after inactivity`)
			apps.delete(appTopic)
			lastActive.delete(appTopic)
			app.close()
		}
	}
}, 5000)

await libp2p.start()

console.log("[replication-server] started libp2p with PeerId", libp2p.peerId.toString())
console.log(
	"[replication-server] listening on",
	libp2p.getMultiaddrs().map((addr) => addr.toString()),
)

console.log("[replication-server] subscribed to discovery topic", discoveryTopic)

const server = getAPI(libp2p)
const metricsServer = getMetricsAPI(libp2p)

server.listen(port, "::", () => {
	const host = `http://localhost:${port}`
	console.log(`[replication-server] API server listening on ${host}`)
	console.log(`GET  ${host}/connections`)
	console.log(`GET  ${host}/subscribers/:topic`)
	console.log(`GET  ${host}/topics`)
	console.log(`POST ${host}/ping/:peerId`)
})

metricsServer.listen(metricsPort, "::", () => {
	const host = `http://localhost:${metricsPort}`
	console.log(`[replication-server] Metrics server listening on ${host}`)
	console.log(`GET  ${host}/metrics`)
})

process.on("SIGINT", async () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	server.close()
	metricsServer.close()
	await libp2p.stop()
	await Promise.all(Array.from(apps.values()).map((app) => app.close()))
	clearInterval(resetTimer)
	apps.clear()
	process.exit(0)
})

// it's unlikely but possible that we end up running this script in node directly
const isNode = process.title === "node"
const isPM2 = process.title.startsWith("node ") && process.title.endsWith("/index.js")

if (restartAt && isPM2) {
	// let the user set a wall clock restart time
	const matches = restartAt.match(/^([0-9]+):([0-9]+)$/)
	if (!matches) {
		console.log("Invalid restart time, must be in format RESTART=23:59")
		process.exit(1)
	}
	const [unused, hours, minutes] = matches
	const alarm = new Date()
	alarm.setHours(parseInt(hours, 10))
	alarm.setMinutes(parseInt(minutes, 10))
	const timeLeft =
		alarm.getTime() > Date.now() ? alarm.getTime() - Date.now() : alarm.getTime() + 24 * 60 * 60 * 1000 - Date.now() // wrap around day

	console.log(
		`[replication-server] next restart at ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}, waiting ${Math.ceil(
			timeLeft / 1000,
		)} seconds...`,
	)

	const restartTimer = setTimeout(() => {
		console.log("[replication-server] alarm triggered, restarting...")
		process.exit(0)
	}, timeLeft)
} else if (restartAt && isNode) {
	console.log("[replication-server] ignored RESTART_AT, try running with pm2")
} else if (restartAt) {
	console.log("[replication-server] unknown execution context, try running with pm2")
}
