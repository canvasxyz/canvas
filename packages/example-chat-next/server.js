import http from "node:http"
import fs from "node:fs"
import path from "node:path"

import next from "next"

import { Core } from "@canvas-js/core"

const directory = path.resolve("data")
if (!fs.existsSync(directory)) {
	fs.mkdirSync(directory)
}

const spec = fs.readFileSync("./spec.canvas.js", "utf-8")

console.log("Initializing core")
global.core = await Core.initialize({ directory, spec, unchecked: true, offline: true })

process.on("SIGINT", () => {
	console.log("Trying to close core gracefully.")
	global.core.close()
})

const port = 3000
const hostname = "localhost"
const app = next({ dev: process.env.NODE_ENV !== "production", hostname, port })
await app.prepare()

const server = http.createServer(app.getRequestHandler())

server.listen(port, () => console.log(`> Ready on http://${hostname}:${port}`))
