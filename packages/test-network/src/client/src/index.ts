import Debugger from "weald"
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
;(Debugger as any).useColors = () => false

import { bytesToHex, randomBytes } from "@noble/hashes/utils"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import { SECONDS } from "@canvas-js/utils"
import { GossipLog } from "@canvas-js/gossiplog/idb"
import { NetworkClient } from "@canvas-js/gossiplog/client"

import { Socket } from "../../socket.js"
import { topic } from "../../constants.js"

const peerId = await createEd25519PeerId()
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

const socket = await Socket.open(`ws://localhost:8000`, peerId, gossipLog)

// libp2p.addEventListener("start", async () => {
// 	console.log("libp2p started")

// 	const root = await messageLog.tree.read((txn) => txn.getRoot())

// 	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })
// })

// libp2p.addEventListener("stop", () => {
// 	console.log("libp2p stopped")
// 	socket.post("stop", {})
// })

// const relayServerPeerId = multiaddr(relayServer).getPeerId()

// libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
// 	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
// 	if (relayServerPeerId === remotePeer.toString()) {
// 		return
// 	}

// 	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
// })

// libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
// 	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
// 	if (relayServerPeerId === remotePeer.toString()) {
// 		return
// 	}

// 	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
// })

await gossipLog.append(bytesToHex(randomBytes(8)))

const maxDelay = parseInt(params.delay ?? "1") * 1000
const delay = maxDelay * Math.random()
console.log(`waiting ${delay}ms...`)
await new Promise((resolve) => setTimeout(resolve, delay))

const network = new NetworkClient(gossipLog, `ws://localhost:9000`)

{
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })

	socket.post("connection:open", {
		id: bytesToHex(randomBytes(8)),
		remotePeer: "12D3KooWNSk8zhzjqcQuXB5QZnmDxjxfKLwnW1y7p7sSgCngAYys",
		remoteAddr: network.sourceURL,
	})
}

// const id = setInterval(() => messageLog.append(bytesToHex(randomBytes(8))), maxDelay)
const id = setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), 10 * SECONDS)

// libp2p.addEventListener("stop", () => clearInterval(id))
