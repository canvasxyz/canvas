import assert from "node:assert"

import express from "express"
import ipld from "express-ipld"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import type { Signature, Message } from "@canvas-js/interfaces"
import type { AbstractGossipLog } from "@canvas-js/gossiplog"

export function createAPI<Payload>(gossipLog: AbstractGossipLog<Payload>): express.Express {
	const api = express()

	api.set("query parser", "simple")

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await gossipLog.getClock()
		return void res.json({ clock, parents })
	})

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params

		const [signature, message] = await gossipLog.get(id)
		if (signature === null || message === null) {
			return void res.status(StatusCodes.NOT_FOUND).end()
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode({ id, signature, message }))
	})

	api.get("/messages", async (req, res) => {
		const { gt, gte, lt, lte, order } = req.query

		assert(gt === undefined || typeof gt === "string", "invalid `gt` query parameter")
		assert(gte === undefined || typeof gte === "string", "invalid `gte` query parameter")
		assert(lt === undefined || typeof lt === "string", "invalid `lt` query parameter")
		assert(lte === undefined || typeof lte === "string", "invalid `lte` query parameter")

		let limit = 64
		if (typeof req.query.limit === "string") {
			limit = parseInt(req.query.limit)
		}

		assert(Number.isSafeInteger(limit) && 0 < limit && limit <= 64, "invalid `limit` query parameter")
		assert(order === undefined || order === "asc" || order === "desc", "invalid `order` query parameter")
		const reverse = order === "desc"

		const results: { id: string; signature: Signature; message: Message }[] = []

		for (const { id, signature, message } of await gossipLog.getMessages({ gt, gte, lt, lte, reverse, limit })) {
			results.push({ id, signature, message })
		}

		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode(results))
	})

	api.post("/messages", ipld(), async (req, res) => {
		try {
			const { signature, message }: { signature: Signature; message: Message<Payload> } = req.body
			const signedMessage = gossipLog.encode(signature, message)
			await gossipLog.insert(signedMessage)
			res.status(StatusCodes.CREATED)
			res.setHeader("Location", `messages/${signedMessage.id}`)
			return void res.end()
		} catch (e) {
			console.error(e)
			return void res.status(StatusCodes.BAD_REQUEST).end(`${e}`)
		}
	})

	return api
}
