import { setTimeout } from "node:timers/promises"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { bytesToHex } from "@noble/hashes/utils"

import { GossipLog } from "@canvas-js/gossiplog/node"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"

import { getLibp2p } from "./libp2p.js"

const { SERVICE_NAME } = process.env

async function start() {
	const messageLog = await GossipLog.open<Uint8Array>({ topic, apply: () => {} }, "data")

	const libp2p = await getLibp2p(messageLog)

	const socket = await Socket.open(libp2p, `ws://dashboard:8000`)

	messageLog.addEventListener("commit", ({ detail: { root } }) => {
		socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
	})

	libp2p.addEventListener("start", async () => {
		console.log("libp2p started")

		const root = await libp2p.services.gossiplog.messageLog.read((txn) => txn.messages.getRoot())
		socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
	})

	libp2p.addEventListener("stop", () => {
		console.log("libp2p stopped")
		socket.post("stop", {})
	})

	libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
		console.log(`connection:open ${remotePeer} ${remoteAddr}`)
		socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
		console.log(`connection:close  ${remotePeer} ${remoteAddr}`)
		socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	// libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
	// 	console.log(`peer:discovery ${id}`, multiaddrs),
	// )

	// libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
	// 	console.log(`peer:identify ${peerId}`, protocols),
	// )

	const gossipsub = libp2p.services.pubsub as GossipSub
	gossipsub.addEventListener("gossipsub:graft", ({ detail: { topic, peerId } }) => {
		const peers = gossipsub.getMeshPeers(topic)
		socket.post("gossipsub:mesh:update", { topic, peers })
	})

	gossipsub.addEventListener("gossipsub:prune", ({ detail: { topic, peerId } }) => {
		const peers = gossipsub.getMeshPeers(topic)
		socket.post("gossipsub:mesh:update", { topic, peers })
	})

	const controller = new AbortController()

	process.addListener("SIGINT", () => {
		process.stdout.write("\nReceived SIGINT\n")
		controller.abort()
		libp2p.stop()
	})

	let delay = 0
	if (SERVICE_NAME !== "bootstrap") {
		delay = 1000 + Math.random() * 5000
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
