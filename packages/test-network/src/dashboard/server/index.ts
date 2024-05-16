import http from "node:http"

import express from "express"
import cors from "cors"
import { WebSocket, WebSocketServer } from "ws"

import PQueue from "p-queue"

import type { Event } from "../../types.js"

const events: Event[] = []
const queues = new Map<express.Response, PQueue>()

function push(res: express.Response, event: Event) {
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
	console.log(`disconnect ${source} from ${target}`)

	const ws = sockets.get(source)
	if (ws === undefined) {
		return res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "disconnect", target }))
})

app.post("/api/provide/:peerId", (req, res) => {
	console.log("PROVIDE", req.params.peerId)

	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "provide" }))
	return res.status(200).end()
})

app.post("/api/query/:peerId", (req, res) => {
	console.log("QUERY", req.params.peerId)
	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "query" }))
	return res.status(200).end()
})

app.post("/api/boop/:peerId", (req, res) => {
	console.log("BOOP", req.params.peerId)

	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "boop" }))
	return res.status(200).end()
})

app.post("/api/events", (req, res) => {
	const event = req.body
	events.push(event)
	for (const [res, queue] of queues) {
		queue.add(() => push(res, event))
	}

	res.status(200).end()
})

app.get("/api/events", (req, res) => {
	res.writeHead(200, {
		["Content-Type"]: "text/event-stream",
		["Cache-Control"]: "no-cache",
		["Connection"]: "keep-alive",
	})

	const queue = new PQueue({ concurrency: 1 })
	queues.set(res, queue)

	for (const event of events) {
		queue.add(() => push(res, event))
	}

	res.on("close", () => {
		queue.clear()
		queues.delete(res)
	})
})

const server = http.createServer(app)

const peerIds = new WeakMap<WebSocket, string>()
const sockets = new Map<string, WebSocket>()

const wss = new WebSocketServer({ server })

wss.on("connection", (ws) => {
	console.log("new socket connection")
	ws.on("open", () => {
		console.log("socket open")
	})

	ws.on("close", () => {
		console.log("socket close")
		const peerId = peerIds.get(ws)
		if (peerId !== undefined) {
			sockets.delete(peerId)
		}
	})

	ws.on("error", (err) => console.error(err))
	ws.on("message", (msg) => {
		const event = JSON.parse(msg.toString()) as Event

		if (!sockets.has(event.peerId)) {
			sockets.set(event.peerId, ws)
			peerIds.set(ws, event.peerId)
		}

		events.push(event)
		for (const [res, queue] of queues) {
			queue.add(() => push(res, event))
		}
	})
})

server.listen(8000, () => {
	console.log("listening on http://localhost:8000")
})
