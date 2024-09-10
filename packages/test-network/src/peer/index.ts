import http from "node:http"
import { setTimeout } from "node:timers/promises"
import { nanoid } from "nanoid"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"
import { DuplexWebSocket } from "it-ws/duplex"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { NetworkServer } from "@canvas-js/gossiplog/network/server"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"
import { bootstrapList, listen, announce } from "./config.js"
import { peerIdFromString } from "@libp2p/peer-id"

const { SERVICE_NAME } = process.env

async function start() {
	const messageLog = new GossipLog<string>({ directory: "data", topic, apply: () => {} })

	// const libp2p = await getLibp2p({ topic, bootstrapList, listen, announce })

	// const socket = await Socket.open(`ws://dashboard:8000`, messageLog, libp2p)
	const peerId = peerIdFromString("12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn")
	const socket = await Socket.open(`ws://dashboard:8000`, messageLog, null, peerId)

	const server = new NetworkServer(messageLog)
	server.wss.listen(8080)
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

	messageLog.addEventListener("commit", ({ detail: { root } }) => {
		socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
	})

	// libp2p.addEventListener("start", async () => {
	// 	console.log("libp2p started")

	// 	const root = await messageLog.tree.read((txn) => txn.getRoot())
	// 	socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
	// })

	{
		const root = await messageLog.tree.read((txn) => txn.getRoot())
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

	messageLog.addEventListener("graft", ({ detail: { peer: peerId } }) => {
		console.log("gossipsub:graft", topic, peerId)
		meshPeers.add(peerId)
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	})

	messageLog.addEventListener("prune", ({ detail: { peer: peerId } }) => {
		console.log("gossipsub:prune", topic, peerId)
		meshPeers.delete(peerId)
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	})

	messageLog.addEventListener("sync", (event) => console.log(`completed sync with ${event.detail.peer}`))

	const controller = new AbortController()

	process.addListener("SIGINT", () => {
		process.stdout.write("\nReceived SIGINT\n")
		controller.abort()
		server.close()
		// libp2p.stop()
	})

	let delay = 0
	if (SERVICE_NAME !== "bootstrap") {
		delay = 1000 + Math.random() * 5000
	}

	await setTimeout(delay)
	// await libp2p.start()
	// await messageLog.listen(libp2p)

	// const intervalId = setInterval(() => void messageLog.append(bytesToHex(randomBytes(8))), 5000)
	// controller.signal.addEventListener("abort", () => clearInterval(intervalId))
}

start()
