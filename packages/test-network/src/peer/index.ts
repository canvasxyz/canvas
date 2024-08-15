import { setTimeout } from "node:timers/promises"

import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { bytesToHex } from "@noble/hashes/utils"
import { nanoid } from "nanoid"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"
import { bootstrapList, listen, announce } from "./config.js"

const { SERVICE_NAME } = process.env

async function start() {
	const messageLog = new GossipLog<string>({ directory: "data", topic, apply: () => {} })

	const libp2p = await getLibp2p({ topic, bootstrapList, listen, announce })

	const socket = await Socket.open(messageLog, libp2p, `ws://dashboard:8000`)

	messageLog.addEventListener("commit", ({ detail: { root } }) => {
		socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
	})

	libp2p.addEventListener("start", async () => {
		console.log("libp2p started")

		const root = await messageLog.tree.read((txn) => txn.getRoot())
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
		console.log(`connection:close ${remotePeer} ${remoteAddr}`)
		socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
	})

	const gossipsub = libp2p.services.pubsub as GossipSub

	messageLog.addEventListener("graft", ({ detail: { peerId } }) => {
		console.log("gossipsub:graft", topic, peerId)
		const peers = gossipsub.getMeshPeers(topic)
		socket.post("gossipsub:mesh:update", { topic, peers })
	})

	messageLog.addEventListener("prune", ({ detail: { peerId } }) => {
		console.log("gossipsub:prune", topic, peerId)
		const peers = gossipsub.getMeshPeers(topic)
		socket.post("gossipsub:mesh:update", { topic, peers })
	})

	messageLog.addEventListener("sync", (event) => console.log(`completed sync with ${event.detail.peerId}`))

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
	await messageLog.listen(libp2p)

	const intervalId = setInterval(() => void messageLog.append(nanoid()), 5000)
	controller.signal.addEventListener("abort", () => clearInterval(intervalId))
}

start()
