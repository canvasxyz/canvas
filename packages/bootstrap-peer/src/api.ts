import express, { Express, json } from "express"
import { StatusCodes } from "http-status-codes"
import client from "prom-client"
import { Libp2p } from "libp2p"

import { ServiceMap } from "./libp2p.js"

export function createAPI(libp2p: Libp2p<ServiceMap>): Express {
	const api = express()

	api.use(json())

	api.get("/api/connections", (req, res) => {
		const connections = libp2p.getConnections().map((conn) => ({
			remotePeer: conn.remotePeer.toString(),
			remoteAddr: conn.remoteAddr.toString(),
			direction: conn.direction,
			status: conn.status,
			rtt: conn.rtt,
		}))

		return res.json(connections)
	})

	const hexPattern = /^[a-f0-9]+$/
	const decimalPattern = /^[0-9]+$/

	api.get("/api/registrations", async (req, res) => {
		let limit = 100
		if (typeof req.query.limit === "string" && decimalPattern.test(req.query.limit)) {
			limit = parseInt(req.query.limit)
		}

		let namespace: string | undefined = undefined
		if (typeof req.query.namespace === "string") {
			namespace = decodeURIComponent(req.query.namespace)
		}

		let cursor: bigint = 0n
		if (typeof req.query.cursor === "string" && hexPattern.test(req.query.cursor)) {
			cursor = BigInt("0x" + req.query.cursor)
		}

		const { rendezvous } = libp2p.services
		const registrations: { peerId: string; multiaddrs: string[]; expiration: number; namespace: string }[] = []
		for await (const registration of rendezvous.store.iterate({ cursor, namespace })) {
			const { id, peerId, multiaddrs, expiration, namespace } = registration
			const count = registrations.push({
				peerId: peerId.toString(),
				multiaddrs: multiaddrs.map((addr) => addr.toString()),
				expiration: parseInt(expiration.toString()),
				namespace,
			})
			cursor = id
			if (count >= limit) {
				break
			}
		}

		res.json({ cursor: cursor.toString(16).padStart(16, "0"), registrations })
	})

	api.get("/metrics", async (req, res) => {
		try {
			const result = await client.register.metrics()
			return void res.writeHead(StatusCodes.OK, { "content-type": client.register.contentType }).end(result)
		} catch (err: any) {
			console.error(err)
			return void res.writeHead(StatusCodes.INTERNAL_SERVER_ERROR).end()
		}
	})

	return api
}
