import WebSocket from "isomorphic-ws"
import { nanoid } from "nanoid"

import { peerIdFromString } from "@libp2p/peer-id"
import type { Libp2p } from "@libp2p/interface"
import type { ServiceMap } from "@canvas-js/gossiplog"

import type { Event } from "./types.js"

export type SocketEvent =
	| { type: "boop" }
	| { type: "provide" }
	| { type: "query" }
	| { type: "disconnect"; target: string }

export class Socket {
	public static async open(libp2p: Libp2p<ServiceMap<string>>, url: string) {
		const ws = new WebSocket(url)
		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }))
		return new Socket(libp2p, ws)
	}

	private constructor(readonly libp2p: Libp2p<ServiceMap<string>>, readonly ws: WebSocket) {
		ws.addEventListener("message", (msg) => {
			const event = JSON.parse(msg.data.toString()) as SocketEvent
			console.log(`event: ${event.type}`)
			if (event.type === "boop") {
				libp2p.services.gossiplog.append(nanoid()).then(
					({ recipients }) =>
						recipients.then(
							(peers) => console.log(`recipients: [ ${peers.join(", ")} ]`),
							(err) => console.error(err),
						),
					(err) => console.error(err),
				)
			} else if (event.type === "provide") {
				// libp2p.services.dht.refreshRoutingTable().catch((err) => console.error(err))
			} else if (event.type === "query") {
				libp2p.services.dht?.refreshRoutingTable().catch((err) => console.error(err))
			} else if (event.type === "disconnect") {
				libp2p.hangUp(peerIdFromString(event.target)).then(
					() => console.log(`disconnected from ${event.target}`),
					(err) => console.error(err),
				)
			}
		})
	}

	public post<T extends Event["type"]>(type: T, detail: (Event & { type: T })["detail"]) {
		const timestamp = Date.now()
		const event = { type, peerId: this.libp2p.peerId.toString(), timestamp, detail }
		this.ws.send(JSON.stringify(event), { binary: false })
	}
}
