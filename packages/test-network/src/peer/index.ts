import assert from "node:assert"
import http from "node:http"
import express from "express"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { Metrics } from "@chainsafe/libp2p-gossipsub/metrics"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { peerIdFromString } from "@libp2p/peer-id"

import { GossipLog } from "@canvas-js/gossiplog/node"

import type { Event } from "../dashboard/shared/types.js"

import { libp2p, topic } from "./libp2p.js"
import { peerId } from "./config.js"
import { Message, Signature } from "@canvas-js/interfaces"

const { SERVICE_NAME } = process.env
assert(typeof SERVICE_NAME === "string")

function post<T extends Event["type"]>(type: T, detail: (Event & { type: T })["detail"]) {
	const t = Date.now()
	fetch("http://host.docker.internal:8000/api/events", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id: peerId, type, t, detail: detail }),
	})
}

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

	libp2p.services.gossiplog.append(topic, randomBytes(16)).then(
		({ recipients }) =>
			recipients.then(
				(peers) => res.status(200).json(peers),
				(err) => res.status(500).end(`${err}`),
			),
		(err) => res.status(500).end(`${err}`),
	)

	// const topics = libp2p.services.pubsub.getTopics()
	// if (!topics.includes(topic)) {
	// 	return res.status(400).end("not subscribed to topic")
	// }
	//
	// libp2p.services.pubsub.publish(topic, data).then(
	// 	({ recipients }) => {
	// 		post("gossipsub:message", { topic, data: bytesToHex(data) })
	// 		res.status(200).json(recipients)
	// 	},
	// 	(err) => res.status(500).end(`${err}`),
	// )
})

http.createServer(app).listen(8000, () => {
	console.log(`API server listening on http://${SERVICE_NAME}:8000`)
})

libp2p.addEventListener("start", () => {
	console.log("libp2p started")
	// if (SERVICE_NAME !== "bootstrap") {
	// 	libp2p.services.pubsub.subscribe(topic)
	// }

	post("start", { hostname: `${SERVICE_NAME}:8000` })
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
	post("stop", {})
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

// libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
// 	console.log(`peer:discovery ${id}`, multiaddrs),
// )

// libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
// 	console.log(`peer:identify ${peerId}`, protocols),
// )

// libp2p.services.pubsub.addEventListener("gossipsub:message", ({ detail: { msg } }) => {
// 	post("gossipsub:message", { topic: msg.topic, data: bytesToHex(msg.data) })
// })

{
	const gossipsub = libp2p.services.pubsub as Omit<GossipSub, "never"> & { metrics: Metrics | null }
	if (gossipsub.metrics) {
		gossipsub.metrics.onAddToMesh = (topic, reason, count) => {
			const peers = gossipsub.getMeshPeers(topic)
			post("gossipsub:mesh:update", { topic, peers })
		}

		gossipsub.metrics.onRemoveFromMesh = (topic, reason, count) => {
			const peers = gossipsub.getMeshPeers(topic)
			post("gossipsub:mesh:update", { topic, peers })
		}
	}
}

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	libp2p.stop()
})

async function apply(id: string, signature: Signature, message: Message<string>) {
	post("gossipsub:message", { topic, data: id })
}

let delay = 0
if (SERVICE_NAME !== "bootstrap") {
	delay = 1000 + Math.random() * 20000
}

setTimeout(() => {
	Promise.resolve(libp2p.start())
		.then(() => GossipLog.open({ topic, apply }, "data"))
		.then((log) => libp2p.services.gossiplog.subscribe(log))
}, delay)
