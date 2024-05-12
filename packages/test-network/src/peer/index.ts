import assert from "node:assert"
import http from "node:http"
import { setTimeout } from "node:timers/promises"

import express from "express"

import { decode, encode } from "@ipld/dag-cbor"

import { GossipSub, multicodec as gossipSubProtocol } from "@chainsafe/libp2p-gossipsub"
import { Metrics } from "@chainsafe/libp2p-gossipsub/metrics"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { peerIdFromBytes, peerIdFromString } from "@libp2p/peer-id"
import { PeerId } from "@libp2p/interface"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"

import { CID } from "multiformats"
import { sha256 } from "multiformats/hashes/sha2"
import * as raw from "multiformats/codecs/raw"

import type { Event } from "../dashboard/shared/types.js"

import { getTopicDHTProtocol, getLibp2p, topic } from "./libp2p.js"

async function start() {
	const libp2p = await getLibp2p()
	// const discoveryTopic = "discovery"

	const { SERVICE_NAME } = process.env
	assert(typeof SERVICE_NAME === "string")

	function post<T extends Event["type"]>(peerId: PeerId, type: T, detail: (Event & { type: T })["detail"]) {
		const t = Date.now()
		fetch("http://dashboard:8000/api/events", {
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
		} else if (topic === null) {
			return res.status(500).end("not subscribed to topic")
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

	app.post("/api/provide", async (req, res) => {
		if (topic === null) {
			return res.status(500).end("not subscribed to topic")
		}

		console.log("PROVIDING DHT RECORD")

		// CID
		const digest = await sha256.digest(new TextEncoder().encode(topic))
		const cid = CID.createV1(raw.code, digest)

		const results: {}[] = []

		for await (const result of libp2p.services.globalDHT.provide(cid)) {
			console.log(`${libp2p.peerId} globalDHT.provide: `, result)
			results.push(result)
		}

		return res.json(results)
	})

	app.post("/api/query", async (req, res) => {
		if (topic === null) {
			return res.status(500).end("not subscribed to topic")
		}

		console.log("QUERYING DHT RECORDS")

		// CID
		const digest = await sha256.digest(new TextEncoder().encode(topic))
		const cid = CID.createV1(raw.code, digest)

		const results: { id: PeerId; multiaddrs: Multiaddr[] }[] = []

		for await (const result of libp2p.services.globalDHT.findProviders(cid)) {
			console.log(`${libp2p.peerId} globalDHT.findProviders: `, result)
			if (result.name === "PROVIDER") {
				results.push(...result.providers)

				for (const { id, multiaddrs } of result.providers) {
					console.log(`[${libp2p.peerId}] dialing ${id}`)
					await libp2p.dial(multiaddrs)
				}
			}
		}

		res.json(results)
	})

	http.createServer(app).listen(8000, () => {
		console.log(`API server listening on http://${SERVICE_NAME}:8000`)
	})

	libp2p.addEventListener("start", async () => {
		console.log("libp2p started")
		// if (SERVICE_NAME !== "bootstrap") {
		// 	libp2p.services.pubsub.subscribe(topic)
		// }
		const root = await libp2p.services.gossiplog.messageLog.read((txn) => txn.messages.getRoot())
		post(libp2p.peerId, "start", {
			hostname: `${SERVICE_NAME}:8000`,
			rootLevel: root.level,
			rootHash: bytesToHex(root.hash),
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

	libp2p.services.fetch.registerLookupFunction("peers/", async (key: string) => {
		const [_, topic] = key.split("/")
		const subscribers = libp2p.services.pubsub.getSubscribers(topic)
		console.log("got subscribers", subscribers)
		const peers = await Promise.all(subscribers.map((peerId) => libp2p.peerStore.get(peerId)))
		return encode(
			peers.map((peer) => ({
				id: peer.id.toBytes(),
				multiaddrs: peer.addresses.map((address) => address.multiaddr.bytes),
			})),
		)
		// return encode(
		// 	subscribers.map((peerId) => {
		// 		const multiaddrs =
		// 		return { peerId: peerId.toBytes() }
		// 	}),
		// )
	})

	const minTopicPeers = 20
	const topicPeers = new Set<string>()

	// libp2p.register("/canvas/fetch/0.0.1", {
	// 	onConnect: async (peerId) => {
	// 		if (topic === null || topicPeers.size >= minTopicPeers) {
	// 			return
	// 		}

	// 		console.log("fetching", peerId, `peers/${topic}`)

	// 		try {
	// 			const result = await libp2p.services.fetch.fetch(peerId, `peers/${topic}`, {})
	// 			if (result === undefined) {
	// 				console.log("got undefined result")
	// 				return
	// 			}

	// 			const peers = decode<{ id: Uint8Array; multiaddrs: Uint8Array[] }[]>(result).map(({ id, multiaddrs }) => ({
	// 				id: peerIdFromBytes(id),
	// 				multiaddrs: multiaddrs.map(multiaddr),
	// 			}))
	// 		} catch (err) {
	// 			console.error("error fetching peers", err)
	// 		}
	// 	},
	// })

	await setTimeout(delay)
	await libp2p.start()

	if (topic !== null) {
		libp2p.register(getTopicDHTProtocol(topic), {
			onConnect: (peerId) => void topicPeers.add(peerId.toString()),
			onDisconnect: (peerId) => void topicPeers.delete(peerId.toString()),
		})
	}

	// libp2p.services.pubsub.subscribe(discoveryTopic)

	if (topic !== null) {
		// const minTopicPeers = 20
		// const topicPeers = new Set<string>()

		// libp2p.register(getTopicDHTProtocol(topic), {
		// 	onConnect: (peerId) => void topicPeers.add(peerId.toString()),
		// 	onDisconnect: (peerId) => void topicPeers.delete(peerId.toString()),
		// })

		// libp2p.services.pubsub.addEventListener("gossipsub:message", ({ detail: { msg } }) => {
		// 	if (msg.type === "signed" && msg.topic === discoveryTopic) {
		// 		const payload = decode<{ topic: string; multiaddrs: Uint8Array[] }>(msg.data)
		// 		if (payload.topic === topic && topicPeers.size < minTopicPeers && !topicPeers.has(msg.from.toString())) {
		// 			const multiaddrs = payload.multiaddrs.map(multiaddr)
		// 			libp2p.dial(multiaddrs).catch((err) => console.error("failed to dial peer", err))
		// 		}
		// 	}
		// })

		// const intervalId = setInterval(() => {
		// 	console.log("PUBLISHING HEARTBEAT")
		// 	libp2p.services.pubsub.publish(
		// 		discoveryTopic,
		// 		encode({ topic, multiaddrs: libp2p.getMultiaddrs().map((addr) => addr.bytes) }),
		// 	)
		// }, 5000)

		// controller.signal.addEventListener("abort", () => clearInterval(intervalId))

		// const log = await GossipLog.open({ topic, apply: () => {} })
		const log = libp2p.services.gossiplog.messageLog

		log.addEventListener("message", ({ detail: { id } }) => {
			// const gossipsub = libp2p.services.pubsub as GossipSub
			// gossipsub.reportMessageValidationResult()

			post(libp2p.peerId, "gossiplog:message", { topic: log.topic, id })
		})

		log.addEventListener("commit", ({ detail: { root } }) => {
			post(libp2p.peerId, "gossiplog:commit", {
				topic: log.topic,
				rootLevel: root.level,
				rootHash: bytesToHex(root.hash),
			})
		})

		const intervalId = setInterval(() => void libp2p.services.gossiplog.append(randomBytes(16)), 3000)
		controller.signal.addEventListener("abort", () => clearInterval(intervalId))
	}
}

start()
