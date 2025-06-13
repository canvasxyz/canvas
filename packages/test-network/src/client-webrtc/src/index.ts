import Debugger from "weald"
;(Debugger as any).useColors = () => false

import { PrivateKey } from "@libp2p/interface"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils"
import { multiaddr } from "@multiformats/multiaddr"
import { SECONDS } from "@canvas-js/utils"

import { GossipLog } from "@canvas-js/gossiplog/idb"

import { Socket } from "../../socket.js"
import { topic } from "../../constants.js"

const gossipLog = await GossipLog.open<string>({ topic, apply: () => {} })

const params: Record<string, string> = {}

if (window.location.search.length > 1) {
	const entries = window.location.search.slice(1).split("&")
	for (const entry of entries) {
		const [key, value] = entry.split("=")
		params[key] = decodeURIComponent(value)
	}
}

let privateKey: PrivateKey
if (params.privateKey !== undefined) {
	privateKey = privateKeyFromProtobuf(hexToBytes(params.privateKey))
} else {
	privateKey = await generateKeyPair("Ed25519")
}

const peerId = peerIdFromPrivateKey(privateKey)

console.log(`using peer id ${peerId}`)

const socket = await Socket.open(`ws://localhost:8000`, peerId, gossipLog)

// await gossipLog.append(bytesToHex(randomBytes(8)))

// const maxDelay = parseInt(params.delay ?? "1") * 1000
// const delay = maxDelay * Math.random()
// console.log(`waiting ${delay}ms...`)
// await new Promise((resolve) => setTimeout(resolve, delay))

const bootstrapServer =
	params.bootstrapServer ?? "/dns4/localhost/tcp/8080/ws/p2p/12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax"

const relayServer =
	params.relayServer ?? "/dns4/localhost/tcp/8081/ws/p2p/12D3KooWPZ12MFRfJv2S13g7aRPYYQ3pSZ7ZsJCj9whnhF3j8WNr"

const relayServerPeerId = multiaddr(relayServer).getPeerId()

const libp2p = await gossipLog.startLibp2p({
	start: false,
	relayServer,
	bootstrapList: [bootstrapServer],
	privateKey,
})

;(window as any).libp2p = libp2p

libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) => {
	console.log(`peer:discovery: ${id} [\n${multiaddrs.map((addr) => `  ${addr.toString()}\n`).join("")}]`)
})

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { topic: gossipLog.topic, root: `0:${bytesToHex(root.hash)}` })
})

// window.addEventListener("beforeunload", () => {
// 	console.log("GOOD BYE GOOD BYE GOOD BYE GOOD BYE GOOD BYE GOOD BYE")
// 	socket.post("stop", {})
// })

// window.addEventListener("beforeunload", () => libp2p.stop())
// libp2p.addEventListener("stop", () => {
// 	console.log("libp2p stopped")
// 	socket.post("stop", {})
// })

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${remotePeer} ${remoteAddr}`)
	if (relayServerPeerId === remotePeer.toString()) {
		return
	}

	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${remotePeer} ${remoteAddr}`)
	if (relayServerPeerId === remotePeer.toString()) {
		return
	}

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

libp2p.start()

// {
// 	const root = await gossipLog.tree.read((txn) => txn.getRoot())
// 	socket.post("start", { topic: gossipLog.topic, root: `0:${bytesToHex(root.hash)}` })

// 	Promise.resolve(libp2p.start()).then(() => console.log("libp2p started"))

// 	socket.post("connection:open", {
// 		id: bytesToHex(randomBytes(8)),
// 		remotePeer: "12D3KooWGrTsJkCdCsVdWFzTUdxsxHPRfbAhUp6qw6RhdtNvnW2Z",
// 		remoteAddr: network.sourceURL,
// 	})
// }

// const id = setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), maxDelay)
setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), 5 * SECONDS)

// // libp2p.addEventListener("stop", () => clearInterval(id))
