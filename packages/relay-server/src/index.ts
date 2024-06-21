import http from "node:http"
import * as cbor from "@ipld/dag-cbor"

import { peerIdFromString } from "@libp2p/peer-id"

import { app } from "./api.js"
import { getLibp2p } from "./libp2p.js"

const { PORT = "3000", FLY_APP_NAME } = process.env
const hostname = FLY_APP_NAME !== undefined ? `${FLY_APP_NAME}.internal` : "localhost"

http.createServer(app).listen(parseInt(PORT), () => {
	console.log(`HTTP API listening on http://${hostname}:${PORT}`)
})

getLibp2p().then(async (libp2p) => {
	libp2p.addEventListener("start", async () => {
		console.log("libp2p started")
	})

	libp2p.addEventListener("stop", () => {
		console.log("libp2p stopped")
	})

	libp2p.addEventListener("connection:open", ({ detail: { remotePeer, remoteAddr } }) => {
		console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	})

	libp2p.addEventListener("connection:close", ({ detail: { remotePeer, remoteAddr } }) => {
		console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	})

	const topicMap = new Map<string, string[]>()
	const topicIndex = new Map<string, Set<string>>()

	app.get("/topicMap", (req, res) => void res.json(Object.fromEntries(topicMap)))
	app.get(
		"/topicIndex",
		(req, res) => void res.json(Object.fromEntries(Array.from(topicIndex).map(([key, value]) => [key, [...value]]))),
	)

	libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
		console.log(`peer:disconnect ${peerId}`)

		for (const topic of topicMap.get(peerId.toString()) ?? []) {
			topicMap.delete(peerId.toString())

			const peers = topicIndex.get(topic)
			peers?.delete(peerId.toString())
			if (peers?.size === 0) {
				topicIndex.delete(topic)
			}
		}
	})

	const getProtocol = (topic: string) => `/canvas/sync/v1/${topic}`
	const protocolPrefix = getProtocol("")

	libp2p.addEventListener("peer:update", ({ detail: { peer, previous } }) => {
		const topics = peer.protocols
			.filter((protocol) => protocol.startsWith(protocolPrefix))
			.map((protocol) => protocol.slice(protocolPrefix.length))

		topicMap.set(peer.id.toString(), topics)

		const previousTopics = previous?.protocols
			.filter((protocol) => protocol.startsWith(protocolPrefix))
			.map((protocol) => protocol.slice(protocolPrefix.length))

		for (const topic of previousTopics ?? []) {
			topicIndex.get(topic)?.delete(peer.id.toString())
		}

		for (const topic of topics) {
			let peers = topicIndex.get(topic)
			if (peers === undefined) {
				peers = new Set()
				topicIndex.set(topic, peers)
			}

			peers.add(peer.id.toString())
		}
	})

	libp2p.services.fetch.registerLookupFunction("topic/", async (key) => {
		const [_, topic] = key.split("/")
		const results: {
			id: Uint8Array
			addresses: { isCertified: boolean; multiaddr: Uint8Array }[]
			protocols: string[]
			peerRecordEnvelope: Uint8Array | null
		}[] = []

		for (const peerId of topicIndex.get(topic) ?? []) {
			const id = peerIdFromString(peerId)
			const peer = await libp2p.peerStore.get(id)
			const addresses = peer.addresses.map(({ isCertified, multiaddr }) => ({
				isCertified,
				multiaddr: multiaddr.bytes,
			}))

			results.push({
				id: id.toBytes(),
				addresses,
				protocols: peer.protocols,
				peerRecordEnvelope: peer.peerRecordEnvelope ?? null,
			})
		}

		console.log("GET", key, `(${results.length} results)`)

		return cbor.encode(results)
	})

	await libp2p.start()
})
