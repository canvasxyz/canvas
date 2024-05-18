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
const port = process.env.PORT ? parseInt(process.env.PORT) : 8000

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
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-extensions",
			"--enable-chrome-browser-cloud-management",
		],
	})
	const page = await browser.newPage()
	await page.setRequestInterception(true)
	page.on("request", (request) => {
		request.respond({
			status: 200,
			contentType: "text/html",
			body: "Success",
		})
	})
	console.log("setting up browser context...")
	await page.goto("https:example.com")

	let connections = {}

	await page.exposeFunction("getBootstrapList", () => {
		return [
			// "/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWK6Sj3eoW9C8FtgBE7DnZmpX9iwt2RgM2NLSLZfSn1Kk1"
			"/dns4/test-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWSndvFSJtqq9NT4qQxB7jni6styhfuY4cZhdavq7daeJe",
			"/dns4/test-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWDoRTPYYdYEgJBptAF7MEZjYV4J82rBp8BoyKe1AXtxgA",
			"/dns4/test-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWQFJcBXTT5LH2aGJzyYRPkBPd4WsqxccmLwpvn6DxLFdq",
		]
	})

	await page.exposeFunction("getClients", () => {
		return { clients: process.env.CLIENTS ? parseInt(process.env.CLIENTS) : 30 }
	})

	await page.exposeFunction("shouldWrite", () => {
		return process.env.WRITE ? true : false
	})

	await page.exposeFunction("log", (...args: any[]) => console.log(...args))
	await page.evaluate(clientJs)
}

checkConnections()

process.on("SIGINT", async () => {
	console.log("\nReceived SIGINT. Attempting to shut down gracefully.")
	server.close()
	process.exit(0)
})
