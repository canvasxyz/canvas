import os from "node:os"

import { libp2p } from "./libp2p.js"
import { peerId } from "./config.js"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import { Metrics } from "@chainsafe/libp2p-gossipsub/metrics"

console.log("os.hostname", os.hostname())

function post(type: string, detail = {}) {
	const t = Date.now()
	fetch("http://dashboard:8000/events", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id: peerId, type, t, detail: detail }),
	})
}

libp2p.addEventListener("start", () => {
	console.log("libp2p started")
	post("start")
})

libp2p.addEventListener("stop", () => {
	console.log("libp2p stopped")
	post("stop")
})

libp2p.addEventListener("connection:open", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:open ${id} ${remotePeer} at ${remoteAddr}`)
	post("connection:open", { id, remotePeer, remoteAddr })
})

libp2p.addEventListener("connection:close", ({ detail: { id, remotePeer, remoteAddr } }) => {
	console.log(`connection:close ${id} ${remotePeer} at ${remoteAddr}`)
	post("connection:close", { id, remotePeer, remoteAddr })
})

libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) =>
	console.log(`peer:discovery ${id}`, multiaddrs),
)

libp2p.addEventListener("peer:identify", ({ detail: { peerId, protocols } }) =>
	console.log(`peer:identify ${peerId}`, protocols),
)

{
	const gossipsub = libp2p.services.pubsub as Omit<GossipSub, "never"> & { metrics: Metrics | null }
	if (gossipsub.metrics) {
		gossipsub.metrics.onAddToMesh = (topic, reason, count) => {
			const peers = gossipsub.getMeshPeers(topic)
			post("gossipsub:mesh:update", { topic, peers })
		}

		gossipsub.metrics.onRemoveFromMesh = (topic, reason, count) => {
			const peers = gossipsub.getMeshPeers(topic)
			post("gossipsub:mesh:update", { topic, peers })
		}
	}
}

await libp2p.start()
libp2p.services.pubsub.subscribe("test-network-example")

process.addListener("SIGINT", () => {
	process.stdout.write("\nReceived SIGINT\n")
	libp2p.stop()
})
