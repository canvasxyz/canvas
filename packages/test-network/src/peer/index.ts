import { setTimeout } from "node:timers/promises"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"

import { Socket } from "../socket.js"
import { bootstrapList, listen, announce, topic } from "./config.js"

const { SERVICE_NAME } = process.env

async function start() {
	const gossipLog = new GossipLog<string>({ directory: "data", topic, apply: () => {} })

	const libp2p = await gossipLog.startLibp2p({ listen, announce, bootstrapList })

	const socket = await Socket.open(`ws://dashboard:8000`, libp2p.peerId, gossipLog)

	{
		const root = await gossipLog.tree.read((txn) => txn.getRoot())
		console.log("starting")
		socket.post("start", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
	}

	libp2p.addEventListener("stop", () => {
		console.log("libp2p stopped")
		socket.post("stop", {})
	})

	libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
		console.log(`connection:open ${remotePeer} ${remoteAddr}`)
		socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
		console.log(`connection:close ${remotePeer} ${remoteAddr}`)
		socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	const meshPeers = new Set<string>()

	libp2p.services.pubsub.addEventListener("gossipsub:graft", ({ detail: { peerId, topic } }) => {
		console.log("gossipsub:graft", peerId.toString())
		if (topic === gossipLog.topic) {
			meshPeers.add(peerId.toString())
			socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
		}
	})

	libp2p.services.pubsub.addEventListener("gossipsub:prune", ({ detail: { peerId, topic } }) => {
		console.log("gossipsub:prune", peerId.toString())
		if (topic === gossipLog.topic) {
			meshPeers.delete(peerId.toString())
			socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
		}
	})

	process.addListener("SIGINT", async () => {
		process.stdout.write("\nReceived SIGINT\n")
		await libp2p.stop()
		await gossipLog.close()
	})

	let delay = 0
	if (SERVICE_NAME !== "bootstrap") {
		delay = 1000 + Math.random() * 5000
	}

	await setTimeout(delay)
	await libp2p.start()

	// const intervalId = setInterval(() => void messageLog.append(bytesToHex(randomBytes(8))), 5000)
	// controller.signal.addEventListener("abort", () => clearInterval(intervalId))
}

start()
