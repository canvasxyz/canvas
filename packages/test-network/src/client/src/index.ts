import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import Debugger from "weald"

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
;(Debugger as any).useColors = () => false

import { GossipLog } from "@canvas-js/gossiplog/idb"
import { NetworkClient } from "@canvas-js/gossiplog/network/client"

import { Socket } from "../../socket.js"
import { topic } from "../../constants.js"
import { SECONDS } from "@canvas-js/utils"

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

const socket = await Socket.open(`ws://localhost:8000`, messageLog, null)

messageLog.addEventListener("commit", ({ detail: commit }) => {
	const { hash, level } = commit.root
	const root = `${level}:${bytesToHex(hash)}`
	socket.post("gossiplog:commit", { topic, root })
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

await messageLog.append(bytesToHex(randomBytes(8)))

const maxDelay = parseInt(params.delay ?? "1") * 1000
const delay = maxDelay * Math.random()
console.log(`waiting ${delay}ms...`)
await new Promise((resolve) => setTimeout(resolve, delay))

const client = new NetworkClient(messageLog, `ws://localhost:8080`)

{
	const root = await messageLog.tree.read((txn) => txn.getRoot())
	socket.post("start", { root: `0:${bytesToHex(root.hash)}` })

	socket.post("connection:open", {
		id: bytesToHex(randomBytes(8)),
		remotePeer: "12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn",
		remoteAddr: client.sourceURL,
	})
}

// const id = setInterval(() => messageLog.append(bytesToHex(randomBytes(8))), maxDelay)
const id = setInterval(() => messageLog.append(bytesToHex(randomBytes(8))), 10 * SECONDS)

// libp2p.addEventListener("stop", () => clearInterval(id))
