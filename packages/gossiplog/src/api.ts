import assert from "node:assert"

import express from "express"
import "express-async-errors"

import ipld from "express-ipld"
import { StatusCodes } from "http-status-codes"
import * as json from "@ipld/dag-json"

import type { Signature, Message } from "@canvas-js/interfaces"
import type { RangeExpression } from "@canvas-js/modeldb"
import {
	AbstractGossipLog,
	MessageSourceType,
	MessageRecord,
	AncestorRecord,
	MessageId,
	MessageSet,
	messageIdPattern,
} from "@canvas-js/gossiplog"

export function createAPI<Payload>(gossipLog: AbstractGossipLog<Payload>): express.Express {
	const api = express()

	api.set("query parser", "simple")

	api.get("/clock", async (req, res) => {
		const [clock, parents] = await gossipLog.getClock()
		return void res.json({ clock, parents })
	})

	api.get("/messages/count", async (req, res) => {
		const range = getRange(req)
		const count = await gossipLog.db.count("$messages", { id: range })
		return void res.json({ count })
	})

	api.get("/messages/:id", async (req, res) => {
		const { id } = req.params

		const signedMessage = await gossipLog.get(id)
		if (signedMessage === null) {
			return void res.status(StatusCodes.NOT_FOUND).end()
		}

		const { signature, message } = signedMessage
		res.writeHead(StatusCodes.OK, { "content-type": "application/json" })
		return void res.end(json.encode({ id, signature, message }))
	})

	api.get("/messages", async (req, res) => {
		const [range, order, limit] = [getRange(req), getOrder(req), getLimit(req)]

		const records = await gossipLog.db.query<{ id: string; data: Uint8Array }>("$messages", {
			select: { id: true, data: true },
			where: { id: range },
			orderBy: { id: order },
			limit,
		})

		const results = records.map(({ data }) => {
			const { id, signature, message } = gossipLog.decode(data)
			return { id, signature, message }
		})

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

	api.get("/ancestors/:id", async (req, res) => {
		assert(messageIdPattern.test(req.params.id), "invalid message ID")
		const { key } = MessageId.encode(req.params.id)

		const records = await gossipLog.db.query<AncestorRecord>("$ancestors", {
			where: { key },
			orderBy: { clock: "asc" },
		})

		return res.json(
			records.map((record) => {
				const links: string[] = []
				for (const { id, clock } of MessageSet.decode(record.links)) {
					assert(clock <= record.clock, "internal error - expected clock <= record.clock")
					links.push(id)
				}

				return { clock: record.clock, links }
			}),
		)
	})

	const connectionURLs = new Set<string>()
	gossipLog.addEventListener("connect", ({ detail: { peer } }) => connectionURLs.add(peer))
	gossipLog.addEventListener("disconnect", ({ detail: { peer } }) => connectionURLs.delete(peer))

	api.get("/connections", (req, res) => res.json(Array.from(connectionURLs).map((peer) => ({ peer }))))

	return api
}

export function getLimit(req: express.Request, max = 64): number {
	let limit = max
	if (typeof req.query.limit === "string") {
		limit = parseInt(req.query.limit)
	}

	assert(Number.isSafeInteger(limit) && 0 < limit && limit <= max, "invalid `limit` query parameter")
	return limit
}

export function getRange(req: express.Request): RangeExpression {
	const { gt, gte, lt, lte } = req.query
	assert(gt === undefined || typeof gt === "string", "invalid `gt` query parameter")
	assert(gte === undefined || typeof gte === "string", "invalid `gte` query parameter")
	assert(lt === undefined || typeof lt === "string", "invalid `lt` query parameter")
	assert(lte === undefined || typeof lte === "string", "invalid `lte` query parameter")

	return { gt, gte, lt, lte }
}

export function getOrder(req: express.Request): "asc" | "desc" {
	const { order } = req.query
	assert(order === undefined || order === "asc" || order === "desc", "invalid `order` query parameter")
	return order ?? "asc"
}
