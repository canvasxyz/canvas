import cors from "cors"
import express from "express"
import ipld from "express-ipld"
import pg from "pg"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { createDatabase } from "./database.js"

// this is copied from @canvas-js/gossiplog - we don't need anything else from that module
const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"

const BOOTSTRAP_LIST =
	process.env.BOOTSTRAP_LIST ||
	"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q"
const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "3334", 10)
const HTTP_PORT = parseInt(process.env.PORT || "3333", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"
const topics = ["chat-example.canvas.xyz"]

console.log(`BOOTSTRAP_LIST: ${BOOTSTRAP_LIST}`)
console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const client = new pg.Client({
	connectionString: process.env.DATABASE_URL || "postgresql://test@localhost:5432/network-explorer",
})
await client.connect()

const queries = await createDatabase(client)

const expressApp = express()
expressApp.use(
	cors({
		origin: "*",
	}),
)

const canvasApps: Record<string, Canvas> = {}

for (const topic of topics) {
	console.log(`initializing canvas for topic ${topic}`)

	const canvasApp = await Canvas.initialize({
		// do we need a separate database url for each topic?
		// path: process.env.DATABASE_URL,
		contract: {
			models: {},
			actions: {
				createMessage() {},
			},
		},
		signers: [new SIWESigner()],
		bootstrapList: [BOOTSTRAP_LIST],
		listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
		topic,
	})

	// create empty counts row for this topic in the index table
	await queries.addCountsRow(topic)

	canvasApp.addEventListener("message", async (event) => {
		const message = event.detail

		if (message.message.payload.type == "action") {
			await queries.addAction(message.message.topic, message.id)
			await queries.incrementActionCounts(message.message.topic)
		} else if (message.message.payload.type == "session") {
			await queries.addSession(message.message.topic, message.id)
			await queries.addAddress(message.message.topic, message.message.payload.did)
			await queries.incrementSessionCounts(message.message.topic)
		}
	})

	await canvasApp.libp2p.start()
	console.log(`peer id: ${canvasApp.libp2p.peerId}`)

	const canvasApiApp = createAPI(canvasApp, { exposeMessages: true, exposeModels: true, exposeP2P: true })
	expressApp.use(`/canvas_api/${topic}`, canvasApiApp)

	canvasApps[topic] = canvasApp
}

expressApp.get("/index_api/messages", ipld(), async (req, res) => {
	const numMessagesToReturn = 10

	let before: string
	if (!req.query.before) {
		before = MAX_MESSAGE_ID
	} else if (typeof req.query.before == "string") {
		before = req.query.before
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const messageIndexEntries = await queries.selectAllMessages(before, numMessagesToReturn)

	const result = []
	for (const messageIndexEntry of messageIndexEntries.rows) {
		const app = canvasApps[messageIndexEntry.topic]
		const messageRecord = await app.getMessage(messageIndexEntry.id)
		if (messageRecord == null) {
			console.error(`Could not find message with id ${messageIndexEntry.id}`)
		}

		// during initialization, the app may be missing messages, and
		// we shouldn't send null signature/message values to the client
		if (messageRecord) {
			result.push({ id: messageIndexEntry.id, ...messageRecord })
		}
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/messages/:topic", ipld(), async (req, res) => {
	const numMessagesToReturn = 10

	if (req.query.type && req.query.type !== "session" && req.query.type !== "action") {
		console.log("invalid type", req.query.type)
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}
	const type = req.query.type || null

	let before: string
	if (!req.query.before) {
		before = MAX_MESSAGE_ID
	} else if (typeof req.query.before == "string") {
		before = req.query.before
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const messageIds = await queries.selectMessages(req.params.topic, before, type, numMessagesToReturn)

	const canvasApp = canvasApps[req.params.topic]
	const result = []
	for (const messageId of messageIds.rows) {
		const messageRecord = await canvasApp.getMessage(messageId.id)
		// during initialization, the app may be missing messages, and
		// we shouldn't send null signature/message values to the client
		if (messageRecord) {
			result.push({ id: messageId.id, ...messageRecord })
		}
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/counts", async (req, res) => {
	const queryResult = (await queries.selectCountsAll()).rows
	const addressCountResult = (await queries.selectAddressCountsAll()).rows
	const addressCountsMap: Record<string, number> = {}
	const connectionCountsMap: Record<string, number> = {}
	const connectionsMap: Record<string, string> = {}
	for (const row of addressCountResult) {
		addressCountsMap[row.topic] = parseInt(row.count, 10)
		connectionCountsMap[row.topic] = canvasApps[row.topic]?.libp2p.getConnections().length
		connectionsMap[row.topic] = canvasApps[row.topic]?.libp2p
			.getConnections()
			.map((c) => c.remoteAddr.toString())
			.join(", ")
	}

	for (const row of queryResult) {
		const r = row as any
		r.address_count = addressCountsMap[row.topic] || 0
		r.connection_count = connectionCountsMap[row.topic] || 0
		r.connections = connectionsMap[row.topic] || "-"
	}

	res.json(queryResult)
})

expressApp.get("/index_api/counts/total", async (req, res) => {
	const queryResult = (await queries.selectCountsTotal()).rows[0]
	const addressCountResult = (await queries.selectAddressCountTotal()).rows[0]
	const result = {
		action_count: queryResult.action_count || 0,
		session_count: queryResult.session_count || 0,
		address_count: addressCountResult.count || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/counts/:topic", async (req, res) => {
	const queryResult = (await queries.selectCounts(req.params.topic)).rows[0]
	const addressCountResult = (await queries.selectAddressCount(req.params.topic)).rows[0]
	const result = {
		topic: req.params.topic,
		action_count: queryResult.action_count || 0,
		session_count: queryResult.session_count || 0,
		address_count: addressCountResult.count || 0,
		connection_count: canvasApps[req.params.topic]?.libp2p.getConnections().length || 0,
	}
	res.json(result)
})

expressApp.get("/index_api/latest_session/:topic", async (req, res) => {
	const canvasApp = canvasApps[req.params.topic]
	if (!canvasApp) {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}
	if (
		!req.query.did ||
		typeof req.query.did !== "string" ||
		!req.query.public_key ||
		typeof req.query.public_key !== "string"
	) {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const sessionId = await canvasApp.getSession({
		did: req.query.did,
		publicKey: req.query.public_key,
	})

	if (!sessionId) {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}

	const messageRecord = await canvasApp.getMessage(sessionId)
	if (!messageRecord || !messageRecord.message || messageRecord.message.payload.type !== "session") {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}

	// return using ipld json stringify
	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(messageRecord.message.payload))
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
