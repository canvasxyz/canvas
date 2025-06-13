import http from "node:http"

import express from "express"
import cors from "cors"
import { WebSocket, WebSocketServer } from "ws"

import { initialState, reduce, type Event, type State } from "../../events.js"

let state: State = initialState
const clients = new Set<express.Response>()

function dispatch(event: Event) {
	state = reduce(state, event)
	for (const res of clients) {
		push(res, event)
	}
}

function push(res: express.Response, body: any) {
	if (res.closed) {
		return
	}

	res.write(`data: ${JSON.stringify(body)}\n\n`)
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
		return void res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "disconnect", target }))
	return void res.status(200).end()
})

app.post("/api/provide/:peerId", (req, res) => {
	console.log("PROVIDE", req.params.peerId)

	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "provide" }))
	return void res.status(200).end()
})

app.post("/api/query/:peerId", (req, res) => {
	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "query" }))
	return void res.status(200).end()
})

app.post("/api/append/:peerId", (req, res) => {
	console.log("append", req.params.peerId)

	const ws = sockets.get(req.params.peerId)
	if (ws === undefined) {
		return void res.status(404).end()
	}

	ws.send(JSON.stringify({ type: "append" }))
	return void res.status(200).end()
})

app.post("/api/events", (req, res) => {
	dispatch(req.body)
	return void res.status(200).end()
})

app.get("/api/events", (req, res) => {
	res.writeHead(200, {
		["Content-Type"]: "text/event-stream",
		["Cache-Control"]: "no-cache",
		["Connection"]: "keep-alive",
	})

	clients.add(res)
	push(res, { type: "snapshot", state })
	res.on("close", () => void clients.delete(res))
})

const workers = new Set<express.Response>()

app.get("/api/workers", (req, res) => {
	res.writeHead(200, {
		["Content-Type"]: "text/event-stream",
		["Cache-Control"]: "no-cache",
		["Connection"]: "keep-alive",
	})

	workers.add(res)
	res.on("close", () => void workers.delete(res))
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
			peerIds.delete(ws)
		}
	})

	ws.on("error", (err) => console.error(err))
	ws.on("message", (msg) => {
		const event = JSON.parse(msg.toString()) as Event

		if (!sockets.has(event.peerId)) {
			sockets.set(event.peerId, ws)
			peerIds.set(ws, event.peerId)
		}

		dispatch(event)
	})
})

server.listen(8000, () => {
	console.log("listening on http://localhost:8000")
})
