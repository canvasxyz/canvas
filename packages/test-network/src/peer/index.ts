import assert from "node:assert"
import http from "node:http"
import { setTimeout } from "node:timers/promises"

import express from "express"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { Metrics } from "@chainsafe/libp2p-gossipsub/metrics"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { peerIdFromString } from "@libp2p/peer-id"
import { PeerId } from "@libp2p/interface"

// import { GossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog } from "@canvas-js/gossiplog/node"

import type { Event } from "../dashboard/shared/types.js"

import { getLibp2p, topic } from "./libp2p.js"

function post<T extends Event["type"]>(peerId: PeerId, type: T, detail: (Event & { type: T })["detail"]) {
	const t = Date.now()
	fetch("http://dashboard:8000/api/events", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id: peerId, type, t, detail: detail }),
	})
}

async function start() {
	const messageLog = await GossipLog.open({ topic, apply: () => {} }, "data")
	const libp2p = await getLibp2p(messageLog)

	messageLog.addEventListener("commit", ({ detail: { root } }) => {
		post(libp2p.peerId, "gossiplog:commit", {
			topic,
			root: `${root.level}:${bytesToHex(root.hash)}`,
		})
	})

	const { SERVICE_NAME } = process.env
	assert(typeof SERVICE_NAME === "string")

	const app = express()

	app.post("/api/disconnect/:peerId", (req, res) => {
		if (libp2p.status !== "started") {
			return res.status(500).end("libp2p not started")
		}

		libp2p.hangUp(peerIdFromString(req.params.peerId)).then(
			() => res.status(200).end(),
			(err) => res.status(500).end(`${err}`),
		)
	})

	app.post("/api/boop", (req, res) => {
		if (libp2p.status !== "started") {
			return res.status(500).end("libp2p not started")
		}

		libp2p.services.gossiplog.append(randomBytes(16)).then(
			({ recipients }) =>
				recipients.then(
					(peers) => res.status(200).json(peers),
					(err) => res.status(500).end(`${err}`),
				),
			(err) => res.status(500).end(`${err}`),
		)
	})

	app.post("/api/provide", (req, res) => {
		if (libp2p.status !== "started") {
			return res.status(500).end("libp2p not started")
		}

		libp2p.services.dht.refreshRoutingTable().then(
			() => res.status(200).json({}),
			(err) => res.status(500).end(`${err}`),
		)
	})

	http.createServer(app).listen(8000, () => {
		console.log(`API server listening on http://${SERVICE_NAME}:8000`)
	})

	libp2p.addEventListener("start", async () => {
		console.log("libp2p started")

		const root = await libp2p.services.gossiplog.messageLog.read((txn) => txn.messages.getRoot())
		post(libp2p.peerId, "start", {
			hostname: `${SERVICE_NAME}:8000`,
			root: `${root.level}:${bytesToHex(root.hash)}`,
		})
	})

	libp2p.addEventListener("stop", () => {
		console.log("libp2p stopped")
		post(libp2p.peerId, "stop", {})
	})

	libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
		post(libp2p.peerId, "connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
		post(libp2p.peerId, "connection:close", {
			id,
			remotePeer: remotePeer.toString(),
			remoteAddr: remoteAddr.toString(),
		})
	})

	libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
		console.log(`peer:discovery ${id}`, multiaddrs),
	)

	// libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
	// 	console.log(`peer:identify ${peerId}`, protocols),
	// )

	{
		const gossipsub = libp2p.services.pubsub as Omit<GossipSub, "metrics"> & { metrics: Metrics | null }
		if (gossipsub.metrics) {
			gossipsub.metrics.onAddToMesh = (topic, reason, count) => {
				const peers = gossipsub.getMeshPeers(topic)
				post(libp2p.peerId, "gossipsub:mesh:update", { topic, peers })
			}

			gossipsub.metrics.onRemoveFromMesh = (topic, reason, count) => {
				const peers = gossipsub.getMeshPeers(topic)
				post(libp2p.peerId, "gossipsub:mesh:update", { topic, peers })
			}
		}
	}

	const controller = new AbortController()

	process.addListener("SIGINT", () => {
		process.stdout.write("\nReceived SIGINT\n")
		controller.abort()
		libp2p.stop()
	})

	let delay = 0
	if (SERVICE_NAME !== "bootstrap") {
		delay = 1000 + Math.random() * 20000
	}

	await setTimeout(delay)
	await libp2p.start()

	// const topicPeers = new Set<string>()
	// libp2p.register(getTopicDHTProtocol(topic), {
	// 	onConnect: (peerId) => void topicPeers.add(peerId.toString()),
	// 	onDisconnect: (peerId) => void topicPeers.delete(peerId.toString()),
	// })

	// const intervalId = setInterval(() => void libp2p.services.gossiplog.append(randomBytes(16)), 1000)
	// controller.signal.addEventListener("abort", () => clearInterval(intervalId))
}

start()
