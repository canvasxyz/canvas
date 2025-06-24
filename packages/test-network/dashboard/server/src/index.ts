import http from "node:http"
import assert from "node:assert"

import express from "express"
import cors from "cors"
import { WebSocket, WebSocketServer } from "ws"

import {
	PeerEvent,
	WorkerEvent,
	NetworkState,
	initialState,
	reduce,
	NetworkEvent,
} from "@canvas-js/test-network/events"
import { StatusCodes } from "http-status-codes"

const { PORT = "8000" } = process.env

let state: NetworkState = initialState
const eventSourceClients = new Set<express.Response>()
const startingPeers: Record<string, number> = {}

function handleEvent(event: PeerEvent | WorkerEvent) {
	state = reduce(state, event)
	for (const res of eventSourceClients) {
		pushEventSource(res, event)
	}

	// There is a race condition here, where if the user starts a peerAdd commentMore actions
	// while autospawn is running, the user's peer could decrement
	// startingPeers and cause autospawn to think that it needs to start
	// more peers than it's supposed to.
	if (event.source === "peer" && event.type === "start" && event.detail.workerId !== null) {
		startingPeers[event.detail.workerId] ??= 1
		startingPeers[event.detail.workerId]--
	}
}

function pushEventSource(res: express.Response, event: NetworkEvent) {
	if (res.closed) {
		return
	}

	res.write(`data: ${JSON.stringify(event)}\n\n`)
}

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.text())

app.use(express.static("dist"))

app.post("/api/disconnect/:source/:target", (req, res) => {
	const { source, target } = req.params
	const ws = peerSockets.get(source)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "disconnect", target }))
	return void res.status(StatusCodes.OK).end()
})

app.post("/api/provide/:peerId", (req, res) => {
	const ws = peerSockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "provide" }))
	return void res.status(StatusCodes.OK).end()
})

app.post("/api/query/:peerId", (req, res) => {
	const ws = peerSockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "query" }))
	return void res.status(StatusCodes.OK).end()
})

app.post("/api/append/:peerId", (req, res) => {
	const ws = peerSockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "append" }))
	return void res.status(StatusCodes.OK).end()
})

app.post("/api/worker/:workerId/start", (req, res) => {
	const ws = workerSockets.get(req.params.workerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "peer:start", publishInterval: null }))
	return void res.status(StatusCodes.OK).end()
})

app.post("/api/worker/:workerId/stop", (req, res) => {
	const { peerId } = req.query
	if (typeof peerId !== "string") {
		return void res.status(StatusCodes.BAD_REQUEST).end("missing peerId query param")
	}

	const ws = workerSockets.get(req.params.workerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	ws.send(JSON.stringify({ type: "peer:stop", id: peerId }))
	return void res.status(StatusCodes.OK).end()
})

// autospawn state

const autoSpawnIntervals = new Map<string, NodeJS.Timeout>()

app.post("/api/worker/:workerId/start/auto", (req, res) => {
	const { workerId } = req.params
	const ws = workerSockets.get(workerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	assert(typeof req.query.total === "string", "missing 'total' query param")
	assert(typeof req.query.lifetime === "string", "missing 'lifetime' query param")
	assert(typeof req.query.publishInterval === "string", "missing 'publishInterval' query param")
	assert(typeof req.query.spawnInterval === "string", "missing 'spawnInterval' query param")
	const total = parseInt(req.query.total)
	const lifetime = parseInt(req.query.lifetime)
	const publishInterval = parseInt(req.query.publishInterval)
	const spawnInterval = parseInt(req.query.spawnInterval)
	assert(!isNaN(total), "invalid 'total' param")
	assert(!isNaN(lifetime), "invalid 'lifetime' param")
	assert(!isNaN(publishInterval), "invalid 'publishInterval' param")
	assert(!isNaN(spawnInterval), "invalid 'spawnInterval' param")

	const timestamp = Date.now()
	handleEvent({
		source: "worker",
		type: "worker:autospawn",
		workerId,
		timestamp,
		detail: { total, lifetime, publishInterval, spawnInterval },
	})

	const spawn = async () => {
		const ws = workerSockets.get(workerId)
		if (ws === undefined) {
			clearInterval(autoSpawnIntervals.get(workerId))
			return
		}

		const nStarted = state.nodes.filter((node) => node.workerId === workerId).length
		const nStarting = startingPeers[workerId] ?? 0
		if (nStarted + nStarting >= total) {
			return
		}

		console.log(`auto-spawning peer on worker ${workerId}: ${nStarting}, ${nStarted}, ${total}`)

		startingPeers[workerId] ??= 0
		startingPeers[workerId]++

		ws.send(JSON.stringify({ type: "peer:start", publishInterval, lifetime }))
	}

	clearInterval(autoSpawnIntervals.get(workerId))
	autoSpawnIntervals.set(workerId, setInterval(spawn, spawnInterval * 1000))
	spawn()

	return void res.status(StatusCodes.OK).end()
})

app.post("/api/worker/:workerId/stop/auto", (req, res) => {
	const { workerId } = req.params

	const ws = workerSockets.get(req.params.workerId)
	if (ws === undefined) {
		return void res.status(StatusCodes.NOT_FOUND).end()
	}

	const timestamp = Date.now()
	handleEvent({
		source: "worker",
		type: "worker:autospawn",
		workerId,
		timestamp,
		detail: { total: null, lifetime: null, publishInterval: null, spawnInterval: null },
	})

	clearInterval(autoSpawnIntervals.get(workerId))

	return void res.status(StatusCodes.OK).end()
})

app.post("/api/events", (req, res) => {
	handleEvent(req.body)
	return void res.status(StatusCodes.OK).end()
})

app.get("/api/events", (req, res) => {
	res.writeHead(StatusCodes.OK, {
		["Content-Type"]: "text/event-stream",
		["Cache-Control"]: "no-cache",
		["Connection"]: "keep-alive",
	})

	eventSourceClients.add(res)
	pushEventSource(res, { source: "network", type: "snapshot", state })
	res.on("close", () => void eventSourceClients.delete(res))
})

const server = http.createServer(app)

const workerIds = new Map<WebSocket, string>()
const workerSockets = new Map<string, WebSocket>()

const peerIds = new Map<WebSocket, string>()
const peerSockets = new Map<string, WebSocket>()

const wss = new WebSocketServer({ server })

wss.on("connection", (ws, req) => {
	assert(req.url, "missing req.url string")
	const url = new URL(req.url, `http://${req.headers.host}`)
	const peerId = url.searchParams.get("peerId")
	const workerId = url.searchParams.get("workerId")

	if (peerId === null && workerId !== null) {
		workerSockets.set(workerId, ws)
		workerIds.set(ws, workerId)

		handleEvent({ source: "worker", type: "worker:start", workerId, timestamp: Date.now(), detail: {} })

		ws.on("close", () => {
			workerSockets.delete(workerId)
			workerIds.delete(ws)
			clearInterval(autoSpawnIntervals.get(workerId))
			handleEvent({ source: "worker", type: "worker:stop", workerId, timestamp: Date.now(), detail: {} })
		})

		ws.on("error", (err) => console.error(err))
		ws.on("message", (msg) => {
			const event = JSON.parse(msg.toString()) as WorkerEvent
			handleEvent(event)
		})
	} else if (peerId !== null && workerId === null) {
		peerSockets.set(peerId, ws)
		peerIds.set(ws, peerId)

		ws.on("close", () => {
			peerSockets.delete(peerId)
			peerIds.delete(ws)
			handleEvent({ source: "peer", type: "stop", peerId, timestamp: Date.now(), detail: {} })
		})

		ws.on("error", (err) => console.error(err))
		ws.on("message", (msg) => {
			const event = JSON.parse(msg.toString()) as PeerEvent
			handleEvent(event)
		})
	} else {
		console.error("invalid websocket URL (expected either peerId or workerId)", {
			url: req.url,
		})

		ws.close()
	}
})

server.listen(parseInt(PORT), () => {
	console.log(`listening on http://localhost:${PORT}`)
})
