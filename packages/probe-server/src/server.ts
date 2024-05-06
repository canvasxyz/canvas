import fs from "node:fs"
import http from "node:http"
import puppeteer from "puppeteer"

import { Connection } from "@libp2p/interface"

import express from "express"
import { StatusCodes } from "http-status-codes"
import { AbortError } from "abortable-iterator"
import { anySignal } from "any-signal"

import client from "prom-client"

const healthyServersGauge = new client.Gauge({
	name: "canvas_replication_servers_healthy",
	help: "canvas_replication_servers_healthy_help",
})

const api = express()
api.set("query parser", "simple")
api.use(express.json())

api.get("/", async (req, res) => res.json({}))

api.get("/metrics", async (req, res) => {
	try {
		const result = await client.register.metrics()
		res.status(StatusCodes.OK)
		res.contentType(client.register.contentType)
		res.end(result)
	} catch (err) {
		console.error(err)
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
	}
})

const server = http.createServer(api)
const port = 8000

server.listen(port, "::", () => {
	const host = `http://localhost:${port}`
	console.log(`[replication-server] API server listening on ${host}`)
	console.log(`GET  ${host}/`)
	console.log(`GET  ${host}/metrics`)
})

const checkConnections = async () => {
	const clientJs = fs.readFileSync("./lib/bundle-compiled.js", { encoding: "utf8" })
	const browser = await puppeteer.launch({
		dumpio: true,
		// headless: "new",
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-extensions",
			"--enable-chrome-browser-cloud-management",
		],
	})
	const page = await browser.newPage()
	await page.goto("https:example.com")

	let connections = {}

	await page.exposeFunction("updateConnections", (_connections: Connection[]) => (connections = _connections))
	await page.exposeFunction("log", (...args: any[]) => console.log(...args))
	await page.evaluate(clientJs)
	await new Promise((resolve) => setTimeout(resolve, 5000))

	const healthy = Object.keys(connections).length
	healthyServersGauge.set(healthy)

	await browser.close()
	console.log("[probe-server] check completed:", healthy)
}

checkConnections()
setInterval(checkConnections, 5 * 60 * 1000)

process.on("SIGINT", async () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	server.close()
	process.exit(0)
})
