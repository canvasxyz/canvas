import http from "node:http"

import express from "express"
import { StatusCodes } from "http-status-codes"
import { AbortError } from "abortable-iterator"
import { anySignal } from "any-signal"

import client from "prom-client"

import type { Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface"
import { peerIdFromString } from "@libp2p/peer-id"

import { PING_TIMEOUT } from "./constants.js"
import { ServiceMap } from "./libp2p.js"

export function getAPI(libp2p: Libp2p<ServiceMap>) {
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
		} catch (err: any) {
			console.error(err)
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
		}
	})

	api.get("/connections", (req, res) => {
		const result: Record<string, { peer: string; addr: string; streams: Record<string, string | null> }> = {}

		for (const { id, remotePeer, remoteAddr, streams } of libp2p.getConnections()) {
			result[id] = {
				peer: remotePeer.toString(),
				addr: remoteAddr.toString(),
				streams: Object.fromEntries(streams.map((stream) => [stream.id, stream.protocol ?? null])),
			}
		}

		return res.status(StatusCodes.OK).json(result)
	})

	api.get("/subscribers/:topic", async (req, res) => {
		const subscribers = libp2p.services.pubsub.getSubscribers(req.params.topic)
		return res.json(subscribers.map((peer) => peer.toString()))
	})

	api.post("/ping/:peerId", async (req, res) => {
		const requestController = new AbortController()
		req.on("close", () => requestController.abort())

		const signal = anySignal([AbortSignal.timeout(PING_TIMEOUT), requestController.signal])

		let peerId: PeerId
		try {
			peerId = peerIdFromString(req.params.peerId)
		} catch (err) {
			return res.status(StatusCodes.BAD_REQUEST).end(`${err}`)
		}

		try {
			const latency = await libp2p.services.ping.ping(peerId, { signal })
			res.status(StatusCodes.OK).end(`Got response from ${peerId} in ${latency}ms\n`)
		} catch (err) {
			if (err instanceof AbortError) {
				res.status(StatusCodes.GATEWAY_TIMEOUT).end(err.toString())
			} else {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(`${err}`)
			}
		} finally {
			signal.clear()
		}
	})

	return http.createServer(api)
}
