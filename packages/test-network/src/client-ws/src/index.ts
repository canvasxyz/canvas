import Debugger from "weald"
;(Debugger as any).useColors = () => false

import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { generateKeyPair } from "@libp2p/crypto/keys"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"

import { GossipLog } from "@canvas-js/gossiplog/idb"
import { NetworkClient } from "@canvas-js/gossiplog/client"

import { PeerSocket } from "@canvas-js/test-network/socket-peer"
import { topic } from "@canvas-js/test-network/constants"

const privateKey = await generateKeyPair("Ed25519")
const peerId = peerIdFromPrivateKey(privateKey)

console.log(`using peer id ${peerId}`)

const gossipLog = await GossipLog.open<string>({ topic, apply: () => {} })

const params: Record<string, string> = {}

if (window.location.search.length > 1) {
	const entries = window.location.search.slice(1).split("&")
	for (const entry of entries) {
		const [key, value] = entry.split("=")
		params[key] = decodeURIComponent(value)
	}
}

const workerId = params.workerId ?? null

const socket = await PeerSocket.open(`ws://localhost:8000`, peerId, gossipLog)

const maxDelay = parseInt(params.delay ?? "1") * 1000
const delay = maxDelay * Math.random()
console.log(`waiting ${delay}ms...`)
await new Promise((resolve) => setTimeout(resolve, delay))

const network = new NetworkClient(gossipLog, `ws://localhost:9000`)

{
	const [clock, heads] = await gossipLog.getClock()
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { topic: gossipLog.topic, root: `0:${bytesToHex(root.hash)}`, workerId, clock, heads })

	socket.post("connection:open", {
		id: bytesToHex(randomBytes(8)),
		remotePeer: "12D3KooWGrTsJkCdCsVdWFzTUdxsxHPRfbAhUp6qw6RhdtNvnW2Z",
		remoteAddr: network.sourceURL,
	})
}

const id = setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), maxDelay)

// const id = setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), 10 * SECONDS)

// libp2p.addEventListener("stop", () => clearInterval(id))
