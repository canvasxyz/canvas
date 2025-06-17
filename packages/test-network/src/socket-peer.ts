import WebSocket from "isomorphic-ws"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"
import { TypedEventEmitter, PeerId } from "@libp2p/interface"
import { AbstractGossipLog } from "@canvas-js/gossiplog"

import { PeerEvent, PeerActions } from "@canvas-js/test-network/events"

export class PeerSocket extends TypedEventEmitter<PeerActions> {
	public static async open(url: string, peerId: PeerId, gossipLog?: AbstractGossipLog<string>) {
		const ws = new WebSocket(url + "?peerId=" + peerId)
		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }))
		return new PeerSocket(ws, peerId.toString(), gossipLog)
	}

	private constructor(
		readonly ws: WebSocket,
		readonly peerId: string,
		readonly gossipLog?: AbstractGossipLog<string>,
	) {
		super()

		ws.addEventListener("message", (msg) => {
			const { type, ...detail } = JSON.parse(msg.data.toString())
			this.dispatchEvent(new CustomEvent(type, { detail }))
		})

		this.addEventListener("append", () => {
			console.log("append received")
			gossipLog?.append(bytesToHex(randomBytes(8)))
		})

		gossipLog?.addEventListener("sync", ({ detail: { peer, messageCount, duration } }) => {
			console.log(`completed sync with ${peer} (${messageCount} messages in ${duration}ms)`)
		})

		gossipLog?.addEventListener("commit", ({ detail: commit }) => {
			const { hash, level } = commit.root
			const root = `${level}:${bytesToHex(hash)}`
			this.post("gossiplog:commit", { topic: gossipLog.topic, root })
		})
	}

	public post<T extends PeerEvent["type"]>(type: T, detail: (PeerEvent & { type: T })["detail"]) {
		const timestamp = Date.now()
		const event = { source: "peer", type, peerId: this.peerId, timestamp, detail }
		this.ws.send(JSON.stringify(event), { binary: false })
	}
}
