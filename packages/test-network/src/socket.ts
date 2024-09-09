import WebSocket from "isomorphic-ws"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"
import { peerIdFromString } from "@libp2p/peer-id"
import type { Libp2p, PeerId } from "@libp2p/interface"
import type { AbstractGossipLog, ServiceMap } from "@canvas-js/gossiplog"

import type { Event } from "./types.js"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

export type SocketEvent =
	| { type: "boop" }
	| { type: "provide" }
	| { type: "query" }
	| { type: "disconnect"; target: string }

export class Socket {
	public static async open(
		url: string,
		messageLog: AbstractGossipLog<string>,
		libp2p: Libp2p<ServiceMap> | null,
		peerId = libp2p?.peerId,
	) {
		const ws = new WebSocket(url)
		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }))

		if (peerId === undefined) {
			peerId = await createEd25519PeerId()
		}

		return new Socket(ws, messageLog, peerId, libp2p)
	}

	private constructor(
		readonly ws: WebSocket,
		readonly messageLog: AbstractGossipLog<string>,
		readonly peerId: PeerId,
		readonly libp2p: Libp2p<ServiceMap> | null,
	) {
		ws.addEventListener("message", (msg) => {
			const event = JSON.parse(msg.data.toString()) as SocketEvent
			console.log(`event: ${event.type}`)
			if (event.type === "boop") {
				messageLog.append(bytesToHex(randomBytes(8))).catch((err) => console.error(err))
				// .then(
				// 	({ recipients }) =>
				// 		recipients.then(
				// 			(peers) => console.log(`recipients: [ ${peers.join(", ")} ]`),
				// 			(err) => console.error(err),
				// 		),
				// 	(err) => console.error(err),
				// )
			} else if (event.type === "provide") {
				// libp2p.services.dht.refreshRoutingTable().catch((err) => console.error(err))
			} else if (event.type === "query") {
				libp2p?.services.dht?.refreshRoutingTable().catch((err) => console.error(err))
			} else if (event.type === "disconnect") {
				libp2p?.hangUp(peerIdFromString(event.target)).then(
					() => console.log(`disconnected from ${event.target}`),
					(err) => console.error(err),
				)
			}
		})
	}

	public post<T extends Event["type"]>(type: T, detail: (Event & { type: T })["detail"]) {
		const timestamp = Date.now()
		const event = { type, peerId: this.peerId.toString(), timestamp, detail }
		this.ws.send(JSON.stringify(event), { binary: false })
	}
}
