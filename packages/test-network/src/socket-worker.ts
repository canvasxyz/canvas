import { randomBytes } from "node:crypto"
import WebSocket from "isomorphic-ws"
import { TypedEventEmitter } from "@libp2p/interface"
import { base32hex } from "multiformats/bases/base32"

import { WorkerEvent, WorkerActions } from "@canvas-js/test-network/events"

export class WorkerSocket extends TypedEventEmitter<WorkerActions & { disconnect: Event }> {
	private reconnectInterval: NodeJS.Timeout | null = null
	private isReconnecting = false
	private isClosed = false

	public static async open(url: string) {
		const workerId = base32hex.baseEncode(randomBytes(5))
		const socket = new WorkerSocket(url, workerId)
		await socket.connect()
		return socket
	}

	private constructor(
		private readonly url: string,
		readonly workerId: string,
	) {
		super()
	}

	private async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(this.url + "?workerId=" + this.workerId)

			ws.addEventListener(
				"open",
				() => {
					this.ws = ws
					this.isReconnecting = false
					this.setupEventListeners()
					resolve()
				},
				{ once: true },
			)

			ws.addEventListener(
				"error",
				(error) => {
					if (!this.isReconnecting) {
						reject(error)
					}
				},
				{ once: true },
			)
		})
	}

	private setupEventListeners() {
		if (!this.ws) return

		this.ws.addEventListener("message", (msg) => {
			const { type, ...detail } = JSON.parse(msg.data.toString())
			this.dispatchEvent(new CustomEvent(type, { detail }))
		})

		this.ws.addEventListener("close", () => {
			if (!this.isClosed) {
				this.startReconnect()
			}
		})

		this.ws.addEventListener("error", () => {
			if (!this.isClosed) {
				this.startReconnect()
			}
		})
	}

	private startReconnect() {
		if (this.isReconnecting || this.isClosed) return
		this.dispatchEvent(new Event("disconnect"))

		this.isReconnecting = true
		this.reconnectInterval = setInterval(async () => {
			try {
				await this.connect()
				if (this.reconnectInterval) {
					clearInterval(this.reconnectInterval)
					this.reconnectInterval = null
				}
			} catch (error) {
				// Continue trying to reconnect
				console.warn("Reconnect attempt failed:", error)
			}
		}, 2000)
	}

	public post<T extends WorkerEvent["type"]>(type: T, detail: (WorkerEvent & { type: T })["detail"]) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn("WebSocket not connected, message not sent")
			return
		}

		const timestamp = Date.now()
		const event = { source: "worker", type, workerId: this.workerId, timestamp, detail }
		this.ws.send(JSON.stringify(event), { binary: false })
	}

	public close() {
		this.isClosed = true
		if (this.reconnectInterval) {
			clearInterval(this.reconnectInterval)
			this.reconnectInterval = null
		}
		if (this.ws) {
			this.ws.close()
		}
	}

	private ws?: WebSocket
}

// import { randomBytes } from "node:crypto"
// import WebSocket from "isomorphic-ws"
// import { TypedEventEmitter } from "@libp2p/interface"
// import { base32hex } from "multiformats/bases/base32"

// import { WorkerEvent, WorkerActions } from "@canvas-js/test-network/events"

// export class WorkerSocket extends TypedEventEmitter<WorkerActions> {
// 	public static async open(url: string) {
// 		const workerId = base32hex.baseEncode(randomBytes(5))
// 		const ws = new WebSocket(url + "?workerId=" + workerId)
// 		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }))
// 		return new WorkerSocket(ws, workerId)
// 	}

// 	private constructor(
// 		readonly ws: WebSocket,
// 		readonly workerId: string,
// 	) {
// 		super()

// 		ws.addEventListener("message", (msg) => {
// 			const { type, ...detail } = JSON.parse(msg.data.toString())
// 			this.dispatchEvent(new CustomEvent(type, { detail }))
// 		})
// 	}

// 	public post<T extends WorkerEvent["type"]>(type: T, detail: (WorkerEvent & { type: T })["detail"]) {
// 		const timestamp = Date.now()
// 		const event = { source: "worker", type, workerId: this.workerId, timestamp, detail }
// 		this.ws.send(JSON.stringify(event), { binary: false })
// 	}
// }
