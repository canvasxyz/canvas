import { peerIdFromString } from "@libp2p/peer-id"
import { multiaddr } from "@multiformats/multiaddr"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import Debugger from "weald"

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
;(Debugger as any).useColors = () => false

import { GossipLog } from "@canvas-js/gossiplog/idb"
// import { getLibp2p, defaultRelayServer } from "@canvas-js/gossiplog/libp2p/browser-webrtc"
// import { defaultRelayServer } from "@canvas-js/gossiplog/libp2p/browser-webrtc"
// import { getLibp2p } from "@canvas-js/gossiplog/libp2p/browser"
import { NetworkClient } from "@canvas-js/gossiplog/network/client"

import { Socket } from "../../socket.js"
import { topic } from "../../constants.js"

const messageLog = await GossipLog.open<string>({ topic, apply: () => {} })

const params: Record<string, string> = {}

if (window.location.search.length > 1) {
	const entries = window.location.search.slice(1).split("&")
	for (const entry of entries) {
		const [key, value] = entry.split("=")
		params[key] = decodeURIComponent(value)
	}
}

const bootstrapList = params.bootstrapList?.split(",") ?? []
console.log(`bootstrap list: ${JSON.stringify(bootstrapList)}`)

// const relayServer = params.relayServer ?? defaultRelayServer
// console.log(`relay server: ${relayServer}`)

// const libp2p = await getLibp2p({ topic, bootstrapList, relayServer })
// const socket = await Socket.open(`ws://localhost:8000`, messageLog, libp2p)
const socket = await Socket.open(`ws://localhost:8000`, messageLog, null)

// Object.assign(window, { libp2p, ping: (peerId: string) => libp2p.services.ping.ping(peerIdFromString(peerId)) })

messageLog.addEventListener("commit", ({ detail: { root } }) => {
	socket.post("gossiplog:commit", { topic, root: `${root.level}:${bytesToHex(root.hash)}` })
})

messageLog.addEventListener("sync", ({ detail: { peer, duration, messageCount } }) =>
	console.log(`completed sync with ${peer} (${messageCount} messages in ${duration}ms)`),
)

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

// libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
// 	console.log(`peer:discovery ${id} [ ${multiaddrs.join(", ")} ]`),
// )

// libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
// 	console.log(`peer:identify ${peerId} [ ${protocols.join(", ")} ]`),
// )

const meshPeers = new Set<string>()

messageLog.addEventListener("graft", ({ detail: { peer } }) => {
	meshPeers.add(peer)
	socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
})

messageLog.addEventListener("prune", ({ detail: { peer } }) => {
	meshPeers.delete(peer)
	socket.post("gossipsub:mesh:update", { topic, peers: Array.from(meshPeers) })
})

const delay = parseInt(params.delay ?? "1") * 1000 * Math.random()
console.log(`waiting ${delay}ms...`)
await new Promise((resolve) => setTimeout(resolve, delay))

// console.log("starting...")
// await libp2p.start()
// await messageLog.listen(libp2p)

const client = new NetworkClient(messageLog, `ws://localhost:8080`)

{
	const root = await messageLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })

	socket.post("connection:open", {
		id: bytesToHex(randomBytes(8)),
		remotePeer: "12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn",
		remoteAddr: client.duplex.remoteAddress,
	})
}

const id = setInterval(() => messageLog.append(bytesToHex(randomBytes(8))), 20000)

// libp2p.addEventListener("stop", () => clearInterval(id))
