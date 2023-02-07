import url from "url"
import { WebSocketServer } from "ws"
import { v4 as uuidv4 } from "uuid"
import type { Message } from "websocket"
import type { Server } from "http"
import chalk from "chalk"

import type { ModelValue } from "@canvas-js/interfaces"
import { Core } from "./core.js"
import { compareResults } from "./api.js"

const WS_KEEPALIVE = 30000
const WS_KEEPALIVE_LATENCY = 3000

type WebSocketID = {
	id: string
	lastMessage: number
}

export function setupWebsockets(server: Server, core: Core): Server {
	const wss = new WebSocketServer({ noServer: true })

	let oldValues: Record<string, ModelValue>[] | null = null
	let listeners: Record<string, Record<string, Record<string, () => void>>> = {}

	const getListener = (ws: WebSocket & WebSocketID, route: string, params: Record<string, string>) => {
		if (listeners[ws.id] && listeners[ws.id][route] && listeners[ws.id][route][JSON.stringify(params)]) {
			return () => listeners[ws.id][route][JSON.stringify(params)]
		}

		const listener = async () => {
			if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
				return
			}

			let newValues: Record<string, ModelValue>[]
			try {
				newValues = await core.getRoute(route, params)
			} catch (err: any) {
				// closed = true
				console.log(chalk.red("[canvas-core] error evaluating route"), err)
				return ws.send(JSON.stringify({ route, params, error: err.toString() }))
			}
			if (oldValues === null || !compareResults(oldValues, newValues)) {
				return ws.send(JSON.stringify({ route, params, data: newValues }))
				oldValues = newValues
			}
		}
		if (!listeners[ws.id]) listeners[ws.id] = {}
		if (!listeners[ws.id][route]) listeners[ws.id][route] = {}
		listeners[ws.id][route][JSON.stringify(params)] = listener
		return listener
	}

	const sendApplicationData = (ws: WebSocket & WebSocketID) => {
		if (core.options.verbose) {
			console.log(chalk.green(`[canvas-core] ws-${ws.id}: sent application status`))
		}

		const { component, routes, actions } = core.vm
		const message = JSON.stringify({
			action: "application",
			data: {
				uri: core.uri,
				appName: core.appName,
				cid: core.cid.toString(),
				peerId: core.libp2p?.peerId.toString(),
				component,
				actions,
				routes: Object.keys(routes),
				peers: core.libp2p && {
					gossip: Object.fromEntries(core.recentGossipPeers),
					sync: Object.fromEntries(core.recentSyncPeers),
				},
			},
		})
		ws.send(message)
	}

	wss.on("connect", (ws, request) => {
		ws.id = uuidv4()
		ws.lastMessage = Date.now()
		if (core.options.verbose) {
			console.log(chalk.green(`[canvas-core] ws-${ws.id}: opened connection`))
		}
		sendApplicationData(ws)

		ws.timer = setInterval(() => {
			if (ws.lastMessage >= +new Date() - (WS_KEEPALIVE + WS_KEEPALIVE_LATENCY)) {
				sendApplicationData(ws)
			} else {
				console.log(chalk.red(`[canvas-core] ws-${ws.id}: closed connection on timeout`))
				ws.close()
				clearInterval(ws.timer)
			}
		}, WS_KEEPALIVE)

		ws.on("message", (data: Message) => {
			ws.lastMessage = +new Date()

			// Respond to keepalive pings
			if (data.toString() === "ping") {
				ws.send("pong")
				return
			}

			// Allow clients to subscribe to routes
			if (core.options.verbose) {
				console.log(chalk.green(`[canvas-core] ws-${ws.id}: received message`))
			}

			try {
				const message = JSON.parse(data.toString())
				if (message.action === "subscribe") {
					const { route, params } = message.data
					const listener = getListener(ws, route, params)
					core.addEventListener("action", listener)
					listener()
				} else if (message.action === "unsubscribe") {
					const { route, params } = message.data
					const listener = getListener(ws, route, params)
					core.removeEventListener("action", listener)
				} else {
					console.log(chalk.red(`[canvas-core] ws-${ws.id}: unrecognized message ${data}`))
				}
			} catch (err) {
				console.log(chalk.red(`[canvas-core] ws-${ws.id}: unknown message "${data}"`, err))
			}
		})

		// Clean up subscriptions when connection closes
		ws.on("close", (data: Message) => {
			if (core.options.verbose) {
				console.log(`[canvas-core] ws-${ws.id}: closed connection`)
			}

			if (listeners[ws.id]) {
				Object.entries(listeners[ws.id]).map(([route, listenersByParams]) => {
					Object.entries(listenersByParams).map(([params, listener]) => {
						core.removeEventListener("action", listener)
						delete listeners[ws.id][route][params]
					})
				})
			}
		})
	})

	server.on("upgrade", (request, socket, head) => {
		if (request.url && url.parse(request.url).pathname?.startsWith("/_next")) {
			return
		}

		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit("connect", ws, request)
		})
	})
	return server
}
