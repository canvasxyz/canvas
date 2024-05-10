// import fs from "node:fs"
// import path from "node:path"

// import { createLibp2p } from "libp2p"
// import PQueue from "p-queue"

// import { topicPattern } from "@canvas-js/gossiplog"
// import { GossipLogService } from "@canvas-js/gossiplog/service"
// import { Canvas } from "@canvas-js/core"

// import { options } from "./libp2p.js"
// import { restartAt, dataDirectory, discoveryTopic } from "./config.js"

// const apps = new Map<string, Canvas>()

// const queue = new PQueue({ concurrency: 1 })

// const libp2p = await createLibp2p(options)

// libp2p.addEventListener("connection:open", ({ detail: connection }) => {
// 	const addr = connection.remoteAddr.decapsulateCode(421).toString()
// 	console.log(`[replication-server] opened connection ${connection.id} to ${connection.remotePeer} on ${addr}`)
// })

// libp2p.addEventListener("connection:close", ({ detail: connection }) => {
// 	console.log(`[replication-server] closed connection ${connection.id} to ${connection.remotePeer}`)
// })

// libp2p.services.discovery.addEventListener("peer:topics", ({ detail: { topics } }) => {
// 	for (const topic of topics) {
// 		if (!topic.startsWith(GossipLogService.topicPrefix)) {
// 			continue
// 		}

// 		const appTopic = topic.slice(GossipLogService.topicPrefix.length)
// 		if (!topicPattern.test(appTopic)) {
// 			console.error("[replication-server] received invalid topic", topic)
// 			continue
// 		}

// 		queue.add(async () => {
// 			if (apps.has(appTopic)) {
// 				return
// 			}

// 			console.log(`[replication-server] Starting app ${appTopic}`)

// 			const directory = path.resolve(dataDirectory, appTopic)
// 			if (!fs.existsSync(directory)) {
// 				console.log("[replication-server] Creating app directory at", directory)
// 				fs.mkdirSync(directory, { recursive: true })
// 			}

// 			const app = await Canvas.initialize({
// 				path: directory,
// 				contract: { topic: appTopic, models: {}, actions: {} },
// 				libp2p,
// 				indexHistory: false,
// 				ignoreMissingActions: true,
// 				disablePing: true,
// 			})

// 			apps.set(appTopic, app)
// 		})
// 	}
// })

// await libp2p.start()

// console.log("[replication-server] started libp2p with PeerId", libp2p.peerId.toString())
// console.log(
// 	"[replication-server] listening on",
// 	libp2p.getMultiaddrs().map((addr) => addr.toString()),
// )

// console.log("[replication-server] subscribed to discovery topic", discoveryTopic)

// process.on("SIGINT", async () => {
// 	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
// 	await libp2p.stop()
// 	await Promise.all(Array.from(apps.values()).map((app) => app.close()))
// 	apps.clear()
// 	process.exit(0)
// })

// // it's unlikely but possible that we end up running this script in node directly
// const isNode = process.title === "node"
// const isPM2 = process.title.startsWith("node ") && process.title.endsWith("/index.js")

// if (restartAt && isPM2) {
// 	// let the user set a wall clock restart time
// 	const matches = restartAt.match(/^([0-9]+):([0-9]+)$/)
// 	if (!matches) {
// 		console.log("Invalid restart time, must be in format RESTART=23:59")
// 		process.exit(1)
// 	}
// 	const [unused, hours, minutes] = matches
// 	const alarm = new Date()
// 	alarm.setHours(parseInt(hours, 10))
// 	alarm.setMinutes(parseInt(minutes, 10))
// 	const timeLeft =
// 		alarm.getTime() > Date.now() ? alarm.getTime() - Date.now() : alarm.getTime() + 24 * 60 * 60 * 1000 - Date.now() // wrap around day

// 	console.log(
// 		`[replication-server] next restart at ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}, waiting ${Math.ceil(
// 			timeLeft / 1000,
// 		)} seconds...`,
// 	)

// 	const restartTimer = setTimeout(() => {
// 		console.log("[replication-server] alarm triggered, restarting...")
// 		process.exit(0)
// 	}, timeLeft)
// } else if (restartAt && isNode) {
// 	console.log("[replication-server] ignored RESTART_AT, try running with pm2")
// } else if (restartAt) {
// 	console.log("[replication-server] unknown execution context, try running with pm2")
// }
