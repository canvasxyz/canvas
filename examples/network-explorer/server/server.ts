import cors from "cors"
import express from "express"
import ipld from "express-ipld"
import pg from "pg"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import { createAPI } from "@canvas-js/core/api"
import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ATPSigner } from "@canvas-js/chain-atp"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
import { SolanaSigner } from "@canvas-js/chain-solana"

// this is copied from @canvas-js/gossiplog - we don't need anything else from that module
const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"

const BOOTSTRAP_LIST =
	process.env.BOOTSTRAP_LIST ||
	"/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q"
const LIBP2P_PORT = parseInt(process.env.LIBP2P_PORT || "8889", 10)
const HTTP_PORT = parseInt(process.env.PORT || "8888", 10)
const HTTP_ADDR = "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"
const topics = process.env.TOPIC ? [process.env.TOPIC] : ["chat-example.canvas.xyz"]

console.log(`BOOTSTRAP_LIST: ${BOOTSTRAP_LIST}`)
console.log(`LIBP2P_PORT: ${LIBP2P_PORT}`)
console.log(`HTTP_PORT: ${HTTP_PORT}`)
console.log(`HTTP_ADDR: ${HTTP_ADDR}`)
console.log(`dev: ${dev}`)

const client = new pg.Client({
	connectionString: process.env.DATABASE_URL || "postgresql://test@localhost:5432/network-explorer",
})
await client.connect()

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
		signers: [new SIWESigner(), new ATPSigner(), new CosmosSigner(), new SubstrateSigner({}), new SolanaSigner()],
		topic,
		schema: {
			$addresses_index: {
				address: "primary",
			},
			$messages_index: {
				id: "primary",
				type: "string",
			},
		},
	})

	// await canvasApp.listen({
	// 	bootstrapList: [BOOTSTRAP_LIST],
	// 	listen: [`/ip4/0.0.0.0/tcp/${LIBP2P_PORT}/ws`],
	// })

	canvasApp.addEventListener("message", async (event) => {
		const message = event.detail

		if (message.message.payload.type === "action") {
			await canvasApp.messageLog.db.set("$messages_index", {
				id: message.id,
				type: "action",
			})
		} else if (message.message.payload.type === "session") {
			await canvasApp.messageLog.db.set("$messages_index", {
				id: message.id,
				type: "action",
			})
			await canvasApp.messageLog.db.set("$addresses_index", {
				address: message.message.payload.did,
			})
		}
	})

	// await canvasApp.libp2p.start()
	// console.log(`peer id: ${canvasApp.libp2p.peerId}`)

	const canvasApiApp = createAPI(canvasApp)
	expressApp.use(`/canvas_api/${topic}`, canvasApiApp)

	canvasApps[topic] = canvasApp
}

expressApp.get("/index_api/messages", ipld(), async (req, res) => {
	// let numMessagesToReturn: number
	// if (!req.query.limit) {
	// 	numMessagesToReturn = 10
	// } else if (typeof req.query.limit === "string") {
	// 	numMessagesToReturn = parseInt(req.query.limit)
	// } else {
	// 	res.status(StatusCodes.BAD_REQUEST)
	// 	res.end()
	// 	return
	// }

	// let before: string
	// if (!req.query.before) {
	// 	before = MAX_MESSAGE_ID
	// } else if (typeof req.query.before === "string") {
	// 	before = req.query.before
	// } else {
	// 	res.status(StatusCodes.BAD_REQUEST)
	// 	res.end()
	// 	return
	// }

	// const messageIndexEntries = await queries.selectAllMessages(before, numMessagesToReturn)
	// TODO: implement this
	const messageIndexEntries = { rows: [] as any[] }

	const result = []
	for (const messageIndexEntry of messageIndexEntries.rows) {
		const app = canvasApps[messageIndexEntry.topic]
		// skip messages from apps that are no longer running
		if (!app) continue
		const signedMessage = await app.getMessage(messageIndexEntry.id)
		// during initialization, the app may be missing messages, and
		// we shouldn't send null signature/message values to the client
		if (signedMessage !== null) {
			result.push([messageIndexEntry.id, signedMessage.signature, signedMessage.message])
		}
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/messages/:topic", ipld(), async (req, res) => {
	let numMessagesToReturn: number
	if (!req.query.limit) {
		numMessagesToReturn = 10
	} else if (typeof req.query.limit === "string") {
		numMessagesToReturn = parseInt(req.query.limit)
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	if (req.query.type !== "session" && req.query.type !== "action") {
		console.log("invalid type", req.query.type)
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}
	const type = req.query.type

	let before: string
	if (!req.query.before) {
		before = MAX_MESSAGE_ID
	} else if (typeof req.query.before === "string") {
		before = req.query.before
	} else {
		res.status(StatusCodes.BAD_REQUEST)
		res.end()
		return
	}

	const canvasApp = canvasApps[req.params.topic]
	const messageIds = await canvasApp.messageLog.db.query("$messages_index", {
		select: { id: true },
		where: {
			type,
			id: { lte: before },
		},
		limit: numMessagesToReturn,
		orderBy: { id: "desc" },
	})

	const result = []
	for (const messageId of messageIds) {
		const signedMessage = await canvasApp.getMessage(messageId.id)
		// during initialization, the app may be missing messages, and
		// we shouldn't send null signature/message values to the client
		if (signedMessage !== null) {
			result.push([messageId.id, signedMessage.signature, signedMessage.message])
		}
	}

	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(result))
})

expressApp.get("/index_api/counts", async (req, res) => {
	const result = []
	for (const topic of topics) {
		const canvasApp = canvasApps[topic]

		const actionCount = await canvasApp.messageLog.db.count("$messages_index", { type: "action" })
		const sessionCount = await canvasApp.messageLog.db.count("$messages_index", { type: "session" })
		const addressCount = await canvasApp.messageLog.db.count("$addresses_index")
		// TODO
		const connections = "-"
		// TODO
		const connectionCount = 0
		result.push({
			topic,
			action_count: actionCount,
			session_count: sessionCount,
			address_count: addressCount,
			connections,
			connection_count: connectionCount,
		})
	}

	res.json(result)
})

expressApp.get("/index_api/counts/:topic", async (req, res) => {
	const canvasApp = canvasApps[req.params.topic]

	const actionCount = await canvasApp.messageLog.db.count("$messages_index", { type: "action" })
	const sessionCount = await canvasApp.messageLog.db.count("$messages_index", { type: "session" })
	const addressCount = await canvasApp.messageLog.db.count("$addresses_index")
	// TODO
	const connections = "-"
	// TODO
	const connectionCount = 0
	const result = {
		topic: req.params.topic,
		action_count: actionCount,
		session_count: sessionCount,
		address_count: addressCount,
		connections,
		connection_count: connectionCount,
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

	const signedMessage = await canvasApp.getMessage(sessionId)
	if (signedMessage === null || signedMessage.message.payload.type !== "session") {
		res.status(StatusCodes.NOT_FOUND)
		res.end()
		return
	}

	// return using ipld json stringify
	res.status(StatusCodes.OK)
	res.setHeader("content-type", "application/json")
	res.end(json.encode(signedMessage.message.payload))
})

expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
	console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
})
