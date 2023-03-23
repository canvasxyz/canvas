import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import { ApplicationData, CoreAPI, CoreEvents, Message, ModelValue } from "@canvas-js/interfaces"

const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/

const WS_KEEPALIVE = 3000

export class RemoteCoreAPI extends EventEmitter<CoreEvents> implements CoreAPI {
	closed = false
	ws: WebSocket | null = null
	timer: number | null = null
	waitingForHeartbeat = false

	constructor(public readonly host: string) {
		super()
		if (this.ws === null) {
			this.ws = this.setupWebsocket(0)
		}
	}

	public close() {
		this.closed = true
		this.clearInterval()
		if (this.ws !== null) {
			this.ws.close()
			this.ws = null
		}
	}

	async getApplicationData(): Promise<ApplicationData> {
		const res = await fetch(this.host)

		if (!res.ok) {
			const message = await res.text()
			throw new Error(message)
		}

		return await res.json()
	}

	async apply(message: Message) {
		const res = await fetch(this.host, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(message),
		})

		if (!res.ok) {
			const message = await res.text()
			throw new Error(message)
		}

		const { hash } = await res.json()
		return { hash }
	}

	async getRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
		route: string,
		params: Record<string, ModelValue> | undefined = {}
	): Promise<T[]> {
		if (!routePattern.test(route)) {
			throw new Error("Invalid route")
		}

		const url = this.getRouteURL(route, params)
		const res = await fetch(url)
		const results = await res.json()
		return results
	}

	private getRouteURL(route: string, params: Record<string, ModelValue>): string {
		const queryParams = { ...params }

		const path = route.slice(1).split("/")
		const pathComponents = path.map((component) => {
			if (component.startsWith(":")) {
				const value = params[component.slice(1)]
				if (value === undefined) {
					throw new Error(`missing parameter ${component}`)
				} else if (typeof value !== "string") {
					throw new Error(`URL parameter ${component} must be a string`)
				}

				delete queryParams[component.slice(1)]
				return encodeURIComponent(value)
			} else {
				return component
			}
		})

		const host = this.host.endsWith("/") ? this.host.slice(0, -1) : this.host

		// add the remainder of the params object to as URI-encoded JSON query params
		const queryComponents = Object.entries(queryParams).map(
			([key, value]) => `${key}=${encodeURIComponent(JSON.stringify(value))}`
		)

		if (queryComponents.length > 0) {
			return `${host}/${pathComponents.join("/")}?${queryComponents.join("&")}`
		} else {
			return `${host}/${pathComponents.join("/")}`
		}
	}

	private reconnect(delay: number) {
		const newDelay = delay < 10000 ? delay + 1000 : delay
		setTimeout(() => {
			this.ws = this.setupWebsocket(newDelay)
		}, delay)
	}

	private clearInterval() {
		if (this.timer !== null) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	private setupWebsocket(delay: number): WebSocket | null {
		const wsHost = this.host.startsWith("/")
			? `ws${document.location.protocol === "https:" ? "s" : ""}://${document.location.host}${this.host}`
			: this.host.startsWith("http://")
			? this.host.replace("http://", "ws://")
			: this.host.startsWith("https://")
			? this.host.replace("https://", "wss://")
			: this.host

		console.log("opening new websocket", wsHost)
		const ws = new WebSocket(wsHost)

		// Set up application data and keep-alive
		ws.addEventListener("message", (event) => {
			if (event.data === "pong") {
				console.log("ws: received pong")
				this.waitingForHeartbeat = false
				return
			}

			try {
				const data = JSON.parse(event.data) as { type: string; detail?: any }
				console.log("ws: received event", data)

				if (data.detail) {
					this.dispatchEvent(new CustomEvent(data.type, { detail: data.detail }))
				} else {
					this.dispatchEvent(new Event(data.type))
				}
			} catch (err) {
				console.log(err)
			}
		})

		ws.addEventListener("open", () => {
			this.timer = window.setInterval(() => {
				if (ws.readyState !== ws.OPEN) return
				if (this.waitingForHeartbeat === true) {
					console.log("ws: closing connection, server did not respond to keep-alive")
					ws.close()
				} else {
					this.waitingForHeartbeat = true
					ws.send("ping")
				}
			}, WS_KEEPALIVE)
		})

		ws.addEventListener("close", () => {
			console.log("ws: connection closed")
			this.clearInterval()
			if (!this.closed) {
				this.reconnect(delay)
			}
		})

		ws.addEventListener("error", (event) => console.error(`ws: error`, event))

		return ws
	}
}
