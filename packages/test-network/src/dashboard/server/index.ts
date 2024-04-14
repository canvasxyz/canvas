import http from "node:http"

import express from "express"
import PQueue from "p-queue"

type Event = any

const events: Event[] = []
const queues = new Map<express.Response, PQueue>()

function push(res: express.Response, event: Event) {
	if (res.closed) {
		return
	}

	res.write(`data: ${JSON.stringify(event)}\n\n`)
}

const app = express()
app.use(express.json())
app.use(express.text())

app.use(express.static("dist"))

app.post("/events", (req, res) => {
	const event = req.body
	const index = events.push(event) - 1
	for (const [res, queue] of queues) {
		queue.add(() => push(res, { index, ...event }))
	}

	res.status(200).end()
})

app.get("/events", (req, res) => {
	let offset = 0
	if (typeof req.query.offset === "string") {
		offset = parseInt(req.query.offset)
	}

	res.writeHead(200, {
		["Content-Type"]: "text/event-stream",
		["Cache-Control"]: "no-cache",
		["Connection"]: "keep-alive",
	})

	const queue = new PQueue({ concurrency: 1 })
	queues.set(res, queue)

	for (const [index, event] of events.entries()) {
		queue.add(() => push(res, { index, ...event }))
	}

	res.on("close", () => {
		queue.clear()
		queues.delete(res)
	})
})

http.createServer(app).listen(8000, () => {
	console.log("listening on http://localhost:8000")
})
