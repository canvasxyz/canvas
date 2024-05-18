import * as cbor from "@ipld/dag-cbor"

import { getLibp2p } from "./libp2p.js"
import { PeerId } from "@libp2p/interface"
import { peerIdFromString } from "@libp2p/peer-id"

const libp2p = await getLibp2p()

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
})

const topicMap = new Map<string, string[]>()
const topicIndex = new Map<string, Set<string>>()

libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
	for (const topic of topicMap.get(peerId.toString()) ?? []) {
		topicMap.delete(topic)

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
	topicMap.set(peer.id.toString(), peer.protocols)

	for (const protocol of previous?.protocols ?? []) {
		if (protocol.startsWith(protocolPrefix)) {
			const topic = protocol.slice(protocolPrefix.length)
			topicIndex.get(topic)?.delete(peer.id.toString())
		}
	}

	for (const protocol of peer.protocols) {
		if (protocol.startsWith(protocolPrefix)) {
			const topic = protocol.slice(protocolPrefix.length)

			let peers = topicIndex.get(topic)
			if (peers === undefined) {
				peers = new Set()
				topicIndex.set(topic, peers)
			}

			peers.add(peer.id.toString())
		}
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
		const addresses = peer.addresses.map(({ isCertified, multiaddr }) => ({ isCertified, multiaddr: multiaddr.bytes }))
		console.log(`got addresses for ${id}: [ ${peer.addresses.map((a) => JSON.stringify(a)).join(", ")} ]`)
		console.log(`got protocols for ${id}: [ ${peer.protocols.join(", ")} ]`)

		results.push({
			id: id.toBytes(),
			addresses,
			protocols: peer.protocols,
			peerRecordEnvelope: peer.peerRecordEnvelope ?? null,
		})
	}

	return cbor.encode(results)
})

await libp2p.start()
