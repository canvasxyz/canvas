import http from "node:http"
import assert from "node:assert"

import express from "express"
import cors from "cors"

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

	const startEvent = events.find((event) => event.type === "start" && event.id === source)
	if (startEvent === undefined) {
		return res.status(404).end()
	}

	assert(startEvent.type === "start")
	const { hostname } = startEvent.detail

	fetch(`http://${hostname}/api/disconnect/${target}`, { method: "POST" }).then(
		(upstreamRes) =>
			upstreamRes.ok ? res.status(200).end() : upstreamRes.text().then((err) => res.status(502).end(err)),
		(err) => {
			console.error("FAILED TO POST", `http://${hostname}/api/disconnect/${target}`)
			res.status(500).end(`${err}`)
		},
	)
})

app.post("/api/provide/:id", (req, res) => {
	console.log("PROVIDE", req.params.id)

	const startEvent = events.find((event) => event.type === "start" && event.id === req.params.id)
	if (startEvent === undefined) {
		return res.status(404).end()
	}

	assert(startEvent.type === "start")
	const { hostname } = startEvent.detail

	fetch(`http://${hostname}/api/provide`, { method: "POST" }).then(
		(upstreamRes) => {
			if (upstreamRes.ok) {
				upstreamRes.json().then((result) => res.status(200).json(result))
			} else {
				upstreamRes.text().then((err) => res.status(502).end(err))
			}
		},
		(err) => {
			console.error("FAILED TO POST", `http://${hostname}/api/provide`)
			res.status(500).end(`${err}`)
		},
	)
})

app.post("/api/query/:id", (req, res) => {
	console.log("QUERY", req.params.id)

	const startEvent = events.find((event) => event.type === "start" && event.id === req.params.id)
	if (startEvent === undefined) {
		return res.status(404).end()
	}

	assert(startEvent.type === "start")
	const { hostname } = startEvent.detail

	fetch(`http://${hostname}/api/query`, { method: "POST" }).then(
		(upstreamRes) => {
			if (upstreamRes.ok) {
				upstreamRes.json().then((result) => res.status(200).json(result))
			} else {
				upstreamRes.text().then((err) => res.status(502).end(err))
			}
		},
		(err) => {
			console.error("FAILED TO POST", `http://${hostname}/api/query`)
			res.status(500).end(`${err}`)
		},
	)
})

app.post("/api/boop/:id", (req, res) => {
	console.log("BOOP", req.params.id)

	const startEvent = events.find((event) => event.type === "start" && event.id === req.params.id)
	if (startEvent === undefined) {
		return res.status(404).end()
	}

	assert(startEvent.type === "start")
	const { hostname } = startEvent.detail

	fetch(`http://${hostname}/api/boop`, { method: "POST" }).then(
		(upstreamRes) => {
			if (upstreamRes.ok) {
				upstreamRes.json().then((recipients) => res.status(200).json(recipients))
			} else {
				upstreamRes.text().then((err) => res.status(502).end(err))
			}
		},
		(err) => {
			console.error("FAILED TO POST", `http://${hostname}/api/boop`)
			res.status(500).end(`${err}`)
		},
	)
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

http.createServer(app).listen(8000, () => {
	console.log("listening on http://localhost:8000")
})
