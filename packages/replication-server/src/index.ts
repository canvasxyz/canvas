import fs from "node:fs"
import path from "node:path"

import { createLibp2p } from "libp2p"
import PQueue from "p-queue"
import client from "prom-client"

import { topicPattern } from "@canvas-js/gossiplog"
import { GossipLogService } from "@canvas-js/gossiplog/service"
import { Canvas, Connection } from "@canvas-js/core"

import { options } from "./libp2p.js"
import {
	port,
	metricsPort,
	restartAt,
	dataDirectory,
	discoveryTopic,
	maxTopics,
	sleepTimeout,
	bootstrapList,
	loopback,
} from "./config.js"
import { getAPI } from "./api.js"
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
const bannedAppsGauge = new client.Gauge({
	name: "canvas_replication_server_banned_apps",
	help: "canvas_replication_server_banned_apps",
	collect() {
		this.set(bannedApps.size)
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

server.listen(port, "::", () => {
	const host = `http://localhost:${port}`
	console.log(`[replication-server] API server listening on ${host}`)
	console.log(`GET  ${host}/connections`)
	console.log(`GET  ${host}/subscribers/:topic`)
	console.log(`GET  ${host}/topics`)
	console.log(`POST ${host}/ping/:peerId`)
})

process.on("SIGINT", async () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	server.close()
	await libp2p.stop()
	await Promise.all(Array.from(apps.values()).map((app) => app.close()))
	clearInterval(resetTimer)
	apps.clear()
	process.exit(0)
})

if (loopback !== undefined) {
	const bootstrapList = [loopback]
	const healthCheckInitialDelay = 30 * 1000
	const healthCheckInterval = 30 * 1000
	const healthCheckGracePeriod = 10 * 1000

	const doHealthCheck = async () => {
		console.log("[replication-server] health check starting")
		const connections: Record<string, Connection> = {}
		const randId = Math.floor(Math.random() * 0xffffff).toString(16)
		const app = await Canvas.initialize({
			contract: { topic: `healthcheck-${randId}.canvas.xyz`, models: {}, actions: {} },
			indexHistory: false,
			ignoreMissingActions: true,
			disablePing: true,
			discoveryTopic,
			bootstrapList,
		})
		app.libp2p.addEventListener("connection:open", ({ detail: connection }) => {
			connections[connection.id] = connection
			console.log("[replication-server] health check found new connection:", connection.remoteAddr)
		})
		app.libp2p.addEventListener("connection:close", ({ detail: connection }) => {
			delete connections[connection.id]
			console.log("[replication-server] health check closed connection", connection.remoteAddr)
		})
		console.log("[replication-server] health check started app")

		setTimeout(() => {
			const healthy = Object.keys(connections).length
			console.log(`[replication-server] health check found ${healthy} connections`)
			if (healthy === 0) {
				process.exit(-1)
			}
		}, healthCheckGracePeriod)
	}
	setTimeout(() => {
		doHealthCheck()
		setInterval(doHealthCheck, healthCheckInterval)
	}, healthCheckInitialDelay)
}
