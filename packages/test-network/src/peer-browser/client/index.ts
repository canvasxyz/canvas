import * as cbor from "@ipld/dag-cbor"

import { bytesToHex } from "@noble/hashes/utils"
import { peerIdFromBytes, peerIdFromString } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { nanoid } from "nanoid"

import Debugger from "debug"

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
;(Debugger as any).useColors = () => false

import { GossipLog } from "@canvas-js/gossiplog/idb"

import { Socket } from "../../socket.js"
import { topic } from "../../constants.js"

import { getLibp2p } from "./libp2p.js"
import { relayServer } from "./config.js"

const messageLog = await GossipLog.open<string>({ topic, apply: () => {} })

const libp2p = await getLibp2p(messageLog)
const socket = await Socket.open(libp2p, `ws://localhost:8000`)

Object.assign(window, { libp2p, ping: (peerId: string) => libp2p.services.ping.ping(peerIdFromString(peerId)) })

messageLog.addEventListener("commit", ({ detail: { root } }) => {
	socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
})

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")

	const root = await messageLog.tree.read((txn) => txn.getRoot())

	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
	socket.post("stop", {})
})

const relayServerPeerId = relayServer && relayServer.getPeerId()

// const getProtocol = (topic: string) => `/canvas/sync/v1/${topic}`

type TopicPeerRecord = {
	id: Uint8Array
	addresses: { isCertified: boolean; multiaddr: Uint8Array }[]
	protocols: string[]
	peerRecordEnvelope: Uint8Array | null
}

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	if (relayServerPeerId === remotePeer.toString()) {
		console.log(`[fetch ${relayServerPeerId}]`)
		libp2p.services.fetch.fetch(peerIdFromString(relayServerPeerId), `topic/${topic}`).then(
			async (result) => {
				const results = cbor.decode<TopicPeerRecord[]>(result ?? cbor.encode([]))
				console.log(`[fetch ${relayServerPeerId}] got ${results.length} results`)
				for (const { id, addresses, protocols, peerRecordEnvelope } of results) {
					const peerId = peerIdFromBytes(id)
					if (peerId.equals(libp2p.peerId)) {
						continue
					}

					await libp2p.peerStore.save(peerId, {
						addresses: addresses.map(({ isCertified, multiaddr: ma }) => ({ isCertified, multiaddr: multiaddr(ma) })),
						protocols: protocols,
						peerRecordEnvelope: peerRecordEnvelope ?? undefined,
					})

					console.log(`[fetch ${relayServerPeerId}] dialing ${peerId}`)

					libp2p.dial(peerId)
				}
			},
			(err) => console.log("fetch failed", err),
		)

		return
	}

	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	if (relayServerPeerId === remotePeer.toString()) {
		return
	}

	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

// libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
// 	console.log(`peer:discovery ${id} [ ${multiaddrs.join(", ")} ]`),
// )

// libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
// 	console.log(`peer:identify ${peerId} [ ${protocols.join(", ")} ]`),
// )

const gossipsub = libp2p.services.pubsub as GossipSub

libp2p.services.pubsub.addEventListener("gossipsub:graft", ({ detail: { topic } }) => {
	const peers = gossipsub.getMeshPeers(topic)
	socket.post("gossipsub:mesh:update", { topic, peers })
})

libp2p.services.pubsub.addEventListener("gossipsub:prune", ({ detail: { topic } }) => {
	const peers = gossipsub.getMeshPeers(topic)
	socket.post("gossipsub:mesh:update", { topic, peers })
})

// libp2p.start()

const delay = 1000 + Math.random() * 20000
setTimeout(() => libp2p.start(), delay)

// const topicPeers = new Set<string>()
// libp2p.register(getTopicDHTProtocol(topic), {
// 	onConnect: (peerId) => void topicPeers.add(peerId.toString()),
// 	onDisconnect: (peerId) => void topicPeers.delete(peerId.toString()),
// })

setInterval(() => void libp2p.services.gossiplog.append(nanoid()), 1000)
