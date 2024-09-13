import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import { GossipLog } from "@canvas-js/gossiplog/sqlite"
import { NetworkServer } from "@canvas-js/gossiplog/network/server"
import { getPeerId } from "@canvas-js/gossiplog/network/peerId"

import { Socket } from "../socket.js"
import { topic } from "../constants.js"

const port = parseInt(process.env.PORT ?? "9000")
const peerId = await getPeerId()

const directory = `data/${bytesToHex(randomBytes(8))}`
console.log("[server] Using directory", directory)
const gossipLog = new GossipLog<string>({ directory, topic, apply: () => {} })

const socket = await Socket.open(`ws://dashboard:8000`, peerId, gossipLog)

const network = new NetworkServer(gossipLog)
network.listen(port)

{
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	console.log("[server] starting")
	socket.post("start", { root: `${root.level}:${bytesToHex(root.hash)}` })
}

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	network.close()
	gossipLog.close()
})
