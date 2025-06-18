import Debugger from "weald"
;(Debugger as any).useColors = () => false

import { PrivateKey } from "@libp2p/interface"
import { peerIdFromPrivateKey } from "@libp2p/peer-id"
import { generateKeyPair, privateKeyFromProtobuf } from "@libp2p/crypto/keys"
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils"
import { multiaddr } from "@multiformats/multiaddr"
import { SECONDS } from "@canvas-js/utils"

import { GossipLog } from "@canvas-js/gossiplog/idb"

import { PeerSocket } from "@canvas-js/test-network/socket-peer"
import { topic } from "@canvas-js/test-network/constants"

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

let privateKey: PrivateKey
if (params.privateKey !== undefined) {
	privateKey = privateKeyFromProtobuf(hexToBytes(params.privateKey))
} else {
	privateKey = await generateKeyPair("Ed25519")
}

const peerId = peerIdFromPrivateKey(privateKey)

console.log(`using peer id ${peerId}`)

const dashboardURL = params.dashboardURL ?? "ws://localhost:8000"
const socket = await PeerSocket.open(dashboardURL, peerId, gossipLog)

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
	if (multiaddrs.length > 0) {
		console.log(`peer:discovery: ${id} [\n${multiaddrs.map((addr) => `  ${addr.toString()}\n`).join("")}]`)
	}
})

libp2p.addEventListener("start", async () => {
	console.log("libp2p started")
	const root = await gossipLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { workerId, topic: gossipLog.topic, root: `0:${bytesToHex(root.hash)}` })
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	if (relayServerPeerId === remotePeer.toString()) {
		return
	}

	socket.post("connection:open", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	if (relayServerPeerId === remotePeer.toString()) {
		return
	}

	socket.post("connection:close", { id, remotePeer: remotePeer.toString(), remoteAddr: remoteAddr.toString() })
})

const meshPeers = new Set<string>()

libp2p.services.pubsub.addEventListener("gossipsub:graft", ({ detail: { peerId, topic } }) => {
	if (topic === gossipLog.topic) {
		meshPeers.add(peerId.toString())
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	}
})

libp2p.services.pubsub.addEventListener("gossipsub:prune", ({ detail: { peerId, topic } }) => {
	if (topic === gossipLog.topic) {
		meshPeers.delete(peerId.toString())
		socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
	}
})

await libp2p.start()

if (params.interval !== undefined) {
	const interval = parseInt(params.interval)
	setInterval(() => gossipLog.append(bytesToHex(randomBytes(8))), interval * SECONDS)
}
