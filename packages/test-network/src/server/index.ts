import { WebSocketServer } from "ws"
import { PeerId } from "@libp2p/interface"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { NetworkServer } from "@canvas-js/gossiplog/server"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"

const { PEER_ID, PORT } = process.env

const port = parseInt(PORT ?? "9000")

let peerId: PeerId
if (typeof PEER_ID === "string") {
	peerId = await createFromProtobuf(Buffer.from(PEER_ID, "base64"))
} else {
	peerId = await createEd25519PeerId()
}

const directory = `data/${bytesToHex(randomBytes(8))}`
console.log("[server] Using directory", directory)
const gossipLog = new GossipLog<string>({ directory, topic, apply: () => {} })

const socket = await Socket.open(`ws://dashboard:8000`, peerId, gossipLog)

const server = new NetworkServer(gossipLog)
const wss = new WebSocketServer({ port })
wss.on("connection", server.handleConnection)

{
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	console.log("[server] starting")
	socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
}

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	server.close()
	wss.close()
	gossipLog.close()
})
