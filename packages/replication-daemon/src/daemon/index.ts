import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"

import express from "express"
import chalk from "chalk"

import { register } from "prom-client"
import PQueue from "p-queue"
import { createLibp2p } from "libp2p"
import { Connection } from "@libp2p/interface"

import { Canvas } from "@canvas-js/core"
import { topicPattern } from "@canvas-js/gossiplog"
import { VM } from "@canvas-js/vm"

import { options } from "./libp2p.js"
import { dataDirectory } from "./config.js"

const controller = new AbortController()

const libp2p = await createLibp2p(options)
console.log("using PeerId", libp2p.peerId.toString())

controller.signal.addEventListener("abort", () => libp2p.stop())
libp2p.addEventListener("start", () => console.log("started libp2p"))
libp2p.addEventListener("stop", () => console.log("stopped libp2p"))

const connections = new Map<string, Connection>()

libp2p.addEventListener("connection:open", ({ detail: connection }) => {
	const addr = connection.remoteAddr.decapsulateCode(421).toString()
	console.log(`opened connection ${connection.id} to ${connection.remotePeer} on ${addr}`)

	connections.set(connection.id, connection)
})

libp2p.addEventListener("connection:close", ({ detail: connection }) => {
	console.log(`closed connection ${connection.id} to ${connection.remotePeer}`)

	connections.delete(connection.id)
})

await libp2p.start()

const apps = new Map<string, Canvas>()
const queue = new PQueue({ concurrency: 1 })

// Start HTTP server
const port = 3000

// Step 2: start an HTTP server
const app = express()
app.use(express.text())
app.use(express.json())
app.use("/", express.static("dist"))

app.get("/metrics", async (req, res) => {
	const libp2pMetrics = await register.metrics()
	res.header("Content-Type", register.contentType)
	res.write(libp2pMetrics + "\n")
	res.end()
})

app.get("/api/state", (req, res) => {
	return res.json({
		peerId: libp2p.peerId.toString(),
		connections: Array.from(connections.values()).map(({ id, remotePeer, remoteAddr }) => ({
			id,
			remotePeer: remotePeer.toString(),
			remoteAddr: remoteAddr.decapsulateCode(421).toString(),
		})),
		apps: fs.readdirSync(dataDirectory).map((topic) => {
			const status = apps.has(topic) ? "started" : "stopped"
			return { topic, status }
		}),
	})
})

const vm = await VM.initialize({})

app.post("/api/apps", async (req, res) => {
	const contract = req.body
	if (typeof contract !== "string") {
		return res.status(400).end()
	}

	const { topic: topicHandle, ...rest } = await vm.import(contract).then((handle) => handle.consume(vm.unwrapObject))
	Object.values(rest).forEach((handle) => handle.dispose())
	const topic = topicHandle.consume(vm.context.getString)

	assert(topicPattern.test(topic), "invalid topic")

	await queue.add(() => {
		console.log("creating", topic)

		assert(!apps.has(topic), "application is running")

		const directory = path.resolve(dataDirectory, topic)
		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory)
		}

		const contractPath = path.resolve(directory, "contract.canvas.js")
		fs.writeFileSync(contractPath, contract, "utf-8")
	})

	return res.status(200).setHeader("location", `#${topic}`).end()
})

app.get("/api/apps/:topic", async (req, res) => {
	assert(topicPattern.test(req.params.topic))

	const directory = path.resolve(dataDirectory, req.params.topic)
	if (fs.existsSync(directory)) {
		const contractPath = path.resolve(directory, "contract.canvas.js")
		fs.createReadStream(contractPath).pipe(res)
	} else {
		return res.status(404).end()
	}
})

app.delete("/api/apps/:topic", async (req, res) => {
	assert(topicPattern.test(req.params.topic))

	await queue.add(async () => {
		console.log("deleting", req.params.topic)

		assert(!apps.has(req.params.topic), "application is running")

		const directory = path.resolve(dataDirectory, req.params.topic)
		assert(fs.existsSync(directory), "application not found")
		fs.rmSync(directory, { recursive: true })
	})

	return res.status(200).end()
})

app.post("/api/apps/:topic/start", async (req, res) => {
	assert(topicPattern.test(req.params.topic))

	await queue.add(async () => {
		console.log("starting", req.params.topic)

		assert(!apps.has(req.params.topic), "already started")

		const directory = path.resolve(dataDirectory, req.params.topic)
		assert(fs.existsSync(directory), "topic not found")

		const contractPath = path.resolve(directory, "contract.canvas.js")
		const contract = fs.readFileSync(contractPath, "utf-8")

		const { indexHistory = "true" } = req.query
		assert(indexHistory === "true" || indexHistory === "false")

		const app = await Canvas.initialize({
			path: directory,
			contract,
			libp2p,
			indexHistory: indexHistory === "true",
		})

		if (app.topic !== req.params.topic) {
			await app.close()
			throw new Error("wrong topic")
		}

		apps.set(app.topic, app)
		console.log("started app", app)
	})

	return res.status(200).end()
})

// TODO: need to support closing a canvas app without stopping the libp2p instance

// app.post("/api/apps/:topic/stop", async (req, res) => {
// 	assert(topicPattern.test(req.params.topic))

// 	await queue.add(async () => {
// 		console.log("stopping", req.params.topic)

// 		const app = apps.get(req.params.topic)
// 		assert(app !== undefined, "application is not running")

// 		await app.close()
// 		apps.delete(req.params.topic)
// 	})

// 	return res.status(200)
// })

const server = app.listen(port, () => {
	console.log(chalk.whiteBright(`Open the dashboard: http://localhost:${port}`))
})

controller.signal.addEventListener("abort", async () => {
	server.closeAllConnections()
	server.close()
	queue.clear()
	await queue.onIdle()
	for (const app of apps.values()) {
		console.log("stopping app", app.topic)
		await app.close()
		console.log("app %s stopped", app.topic)
	}
})

let stopping = false
process.on("SIGINT", async () => {
	if (stopping) {
		process.exit(1)
	} else {
		stopping = true
		process.stdout.write(
			`\n${chalk.yellow("Received SIGINT, attempting to exit gracefully. ^C again to force quit.")}\n`,
		)
		controller.abort()
	}
})
