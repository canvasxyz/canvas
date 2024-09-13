import { setTimeout } from "node:timers/promises"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { NetworkPeer } from "@canvas-js/gossiplog/network/peer"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"
import { bootstrapList, listen, announce } from "./config.js"

const { SERVICE_NAME } = process.env

async function start() {
	const gossipLog = new GossipLog<string>({ directory: "data", topic, apply: () => {} })

	const network = await NetworkPeer.create(gossipLog, { listen, announce, bootstrapList })

	const socket = await Socket.open(`ws://dashboard:8000`, network.peerId, gossipLog)

	// api.addListener("connection", (connection: DuplexWebSocket) => {
	// 	const remoteAddr = connection.remoteAddress
	// 	const id = nanoid()
	// 	console.log(`connection:open ${id} ${remoteAddr}`)
	// 	socket.post("connection:open", { id, remotePeer: id, remoteAddr: remoteAddr.toString() })
	// 	connection.socket.addListener("close", () => {
	// 		console.log(`connection:close ${id} ${remoteAddr}`)
	// 		socket.post("connection:close", { id, remotePeer: id, remoteAddr })
	// 	})
	// })

	// libp2p.addEventListener("start", async () => {
	// 	console.log("libp2p started")

	// 	const root = await messageLog.tree.read((txn) => txn.getRoot())
	// 	socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
	// })

	{
		const root = await gossipLog.tree.read((txn) => txn.getRoot())
		console.log("starting")
		socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
	}

	// libp2p.addEventListener("stop", () => {
	// 	console.log("libp2p stopped")
	// 	socket.post("stop", {})
	// })

	// libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	// 	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	// 	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	// })

	// libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	// 	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	// 	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	// })

	const meshPeers = new Set<string>()

	network.pubsub.addEventListener("gossipsub:graft", ({ detail: { peerId } }) => {
		console.log("gossipsub:graft", peerId.toString())
		meshPeers.add(peerId.toString())
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	})

	network.pubsub.addEventListener("gossipsub:prune", ({ detail: { peerId } }) => {
		console.log("gossipsub:prune", peerId.toString())
		meshPeers.delete(peerId.toString())
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	})

	process.addListener("SIGINT", async () => {
		process.stdout.write("\nReceived SIGINT\n")
		await network.stop()
		await gossipLog.close()
	})

	let delay = 0
	if (SERVICE_NAME !== "bootstrap") {
		delay = 1000 + Math.random() * 5000
	}

	await setTimeout(delay)
	await network.start()

	// const intervalId = setInterval(() => void messageLog.append(bytesToHex(randomBytes(8))), 5000)
	// controller.signal.addEventListener("abort", () => clearInterval(intervalId))
}

start()
