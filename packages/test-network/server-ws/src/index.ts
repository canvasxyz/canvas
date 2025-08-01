import { WebSocketServer } from "ws"
import { PrivateKey } from "@libp2p/interface"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { NetworkServer } from "@canvas-js/gossiplog/server"

import { PeerSocket } from "@canvas-js/test-network/socket-peer"
import { topic } from "@canvas-js/test-network/constants"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"

const { LIBP2P_PRIVATE_KEY, PORT } = process.env

const port = parseInt(PORT ?? "9000")

let privateKey: PrivateKey
if (typeof LIBP2P_PRIVATE_KEY === "string") {
	privateKey = privateKeyFromProtobuf(Buffer.from(LIBP2P_PRIVATE_KEY, "base64"))
} else {
	privateKey = await generateKeyPair("Ed25519")
}

const peerId = peerIdFromPrivateKey(privateKey)

const directory = `data/${bytesToHex(randomBytes(8))}`
console.log("[server] Using directory", directory)
const gossipLog = await GossipLog.open<string>(directory, { topic, apply: () => {} })

const socket = await PeerSocket.open(`ws://dashboard:8000`, peerId, gossipLog)

const server = new NetworkServer(gossipLog)
const wss = new WebSocketServer({ port })
wss.on("connection", server.handleConnection)

{
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	const [clock, heads] = await gossipLog.getClock()
	console.log("[server] starting")
	socket.post("start", {
		topic: gossipLog.topic,
		root: `${root.level}:${bytesToHex(root.hash)}`,
		workerId: null,
		clock,
		heads,
	})
}

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	server.close()
	wss.close()
	gossipLog.close()
})
