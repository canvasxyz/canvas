import { randomBytes } from "node:crypto"
import WebSocket from "isomorphic-ws"
import { TypedEventEmitter } from "@libp2p/interface"
import { base32hex } from "multiformats/bases/base32"

import { WorkerEvent, WorkerActions } from "@canvas-js/test-network/events"

export class WorkerSocket extends TypedEventEmitter<WorkerActions> {
	public static async open(url: string) {
		const workerId = base32hex.baseEncode(randomBytes(5))
		const ws = new WebSocket(url + "?workerId=" + workerId)
		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }))
		return new WorkerSocket(ws, workerId)
	}

	private constructor(
		readonly ws: WebSocket,
		readonly workerId: string,
	) {
		super()

		ws.addEventListener("message", (msg) => {
			const { type, ...detail } = JSON.parse(msg.data.toString())
			this.dispatchEvent(new CustomEvent(type, { detail }))
		})
	}

	public post<T extends WorkerEvent["type"]>(type: T, detail: (WorkerEvent & { type: T })["detail"]) {
		const timestamp = Date.now()
		const event = { source: "worker", type, workerId: this.workerId, timestamp, detail }
		this.ws.send(JSON.stringify(event), { binary: false })
	}
}
