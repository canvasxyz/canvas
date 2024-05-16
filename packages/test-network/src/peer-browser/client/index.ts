import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { PeerId } from "@libp2p/interface"

// import { GossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog } from "@canvas-js/gossiplog/browser"

import { Socket } from "../../socket.js"

import { getLibp2p, topic } from "./libp2p.js"

const messageLog = await GossipLog.open<Uint8Array>({ topic, apply: () => {} })

const libp2p = await getLibp2p(messageLog)
const socket = await Socket.open(libp2p, `ws://localhost:8000`)

messageLog.addEventListener("commit", ({ detail: { root } }) => {
	socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
})

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")

	const root = await messageLog.read((txn) => txn.messages.getRoot())

	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
	socket.post("stop", {})
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
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

libp2p.start()

// const delay = 1000 + Math.random() * 20000
// setTimeout(() => libp2p.start(), delay)

// const topicPeers = new Set<string>()
// libp2p.register(getTopicDHTProtocol(topic), {
// 	onConnect: (peerId) => void topicPeers.add(peerId.toString()),
// 	onDisconnect: (peerId) => void topicPeers.delete(peerId.toString()),
// })

// setInterval(() => void libp2p.services.gossiplog.append(randomBytes(16)), 1000)
