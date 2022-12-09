import assert from "node:assert"

import { v4 as uuidv4 } from "uuid"
import { WebSocketServer } from "ws"
import type { Message } from "websocket"
import type { Server } from "http"
import chalk from "chalk"
import express from "express"
import { StatusCodes } from "http-status-codes"
import client from "prom-client"

import type { ModelValue } from "@canvas-js/interfaces"
import { Core } from "./core.js"

const collectDefaultMetrics = client.collectDefaultMetrics
collectDefaultMetrics()

type WebSocketID = {
	id: string
}

interface Options {
	exposeMetrics: boolean
	exposeModels: boolean
	exposeSessions: boolean
	exposeActions: boolean
}

const gauges: Record<string, client.Gauge<string>> = {}

export function bindWebsockets(server: Server, core: Core): Server {
	const wss = new WebSocketServer({ noServer: true })
	console.log("Binding Websockets")

	let oldValues: Record<string, ModelValue>[] | null = null
	let listeners: Record<string, Record<string, Record<string, () => void>>> = {}

	const getListener = (ws: WebSocket & WebSocketID, route: string, params: Record<string, ModelValue>) => {
		if (listeners[ws.id] && listeners[ws.id][route] && listeners[ws.id][route][JSON.stringify(params)]) {
			return () => listeners[ws.id][route][JSON.stringify(params)]
		}

		const listener = () => {
			if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
				return
			}

			let newValues: Record<string, ModelValue>[]
			try {
				newValues = core.getRoute(route, params)
			} catch (err: any) {
				// closed = true
				console.log(chalk.red("[canvas-cli] error evaluating route"), err)
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
	wss.on("connect", (ws, request) => {
		ws.id = uuidv4()

		// Allow clients to subscribe to routes
		ws.on("message", (data: Message) => {
			if (data.toString() === "ping") return ws.send("pong")
			try {
				const message = JSON.parse(data.toString())
				if (message.action === "subscribe") {
					const { route, params } = message.data
					const listener = getListener(ws, route, params)
					core.addEventListener("action", listener)
					listener()
				} else if (message.action === "unsubscribe") {
					// TODO: make factory return same instance
					const { route, params } = message.data
					const listener = getListener(ws, route, params)
					core.removeEventListener("action", listener)
				} else {
					console.log(`Received unrecognized message ${JSON.stringify(message)}`)
				}
			} catch (error) {
				console.log(`Received unknown message "${data}"`, error)
			}
		})
		ws.on("close", (data: Message) => {
			console.log(`Received close`)
			Object.entries(listeners[ws.id]).map(([route, listenersByParams]) => {
				Object.entries(listenersByParams).map(([params, listener]) => {
					core.removeEventListener("action", listener)
					delete listeners[ws.id][route][params]
				})
			})
		})
	})

	server.on("upgrade", (request, socket, head) => {
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit("connect", ws, request)
		})
	})
	return server
}

export function getAPI(core: Core, options: Partial<Options> = {}): express.Express {
	const api = express()

	api.set("query parser", "simple")
	api.use(express.json())

	api.get("/", (req, res) => {
		const { component, routeParameters, actions } = core.vm
		const routes = Object.keys(routeParameters)

		return res.json({
			uri: core.uri,
			cid: core.cid.toString(),
			peerId: core.libp2p?.peerId.toString(),
			component,
			actions,
			routes,
			peers: core.libp2p
				? {
						gossip: Object.fromEntries(core.recentGossipSubPeers),
						backlog: Object.fromEntries(core.recentBacklogSyncPeers),
				  }
				: null,
		})
	})

	api.post("/actions", async (req, res) => {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			const { hash } = await core.applyAction(req.body)
			res.json({ hash })
		} catch (err: any) {
			console.log(chalk.red(`[canvas-core] Failed to apply action:`), err)
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.toString())
		}
	})

	api.post("/sessions", async (req, res) => {
		if (req.headers["content-type"] !== "application/json") {
			return res.status(StatusCodes.UNSUPPORTED_MEDIA_TYPE).end()
		}

		try {
			const { hash } = await core.applySession(req.body)
			res.json({ hash })
		} catch (err: any) {
			console.log(chalk.red(`[canvas-core] Failed to create session:`), err)
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.toString())
		}
	})

	if (options.exposeMetrics) {
		api.get("/metrics", async (req, res) => {
			try {
				const result = await client.register.metrics()
				res.header("Content-Type", client.register.contentType)
				return res.end(result)
			} catch (err: any) {
				return res.status(StatusCodes.INTERNAL_SERVER_ERROR).end()
			}
		})
	}

	for (const route of Object.keys(core.vm.routes)) {
		api.get(route, (req, res) => handleRoute(core, route, req, res))
	}

	if (options.exposeModels) {
		api.get("/models/:model", (req, res) => {
			const { model } = req.params
			if (model in core.vm.models) {
				const query = `SELECT * FROM ${model} ORDER BY updated_at DESC LIMIT 10`
				const rows = core.modelStore.database.prepare(query).all()
				return res.status(StatusCodes.OK).json(rows)
			} else {
				return res.status(StatusCodes.NOT_FOUND).end()
			}
		})
	}

	if (options.exposeActions) {
		// TODO: pagination
		api.get("/actions", (req, res) => {
			const actions = []
			for (const entry of core.messageStore.getActionStream()) {
				actions.push(entry)
			}

			return res.status(StatusCodes.OK).json(actions)
		})
	}

	if (options.exposeSessions) {
		// TODO: pagination
		api.get("/sessions", (req, res) => {
			const sessions = []
			for (const entry of core.messageStore.getSessionStream()) {
				sessions.push(entry)
			}

			return res.status(StatusCodes.OK).json(sessions)
		})
	}

	return api
}

async function handleRoute(core: Core, route: string, req: express.Request, res: express.Response) {
	const routeParameters = core.vm.routeParameters[route]
	assert(routeParameters !== undefined)

	const params: Record<string, ModelValue> = {}
	for (const param of routeParameters) {
		const value = req.params[param]
		assert(value !== undefined, `missing route param ${param}`)
		params[param] = value
	}

	for (const [param, value] of Object.entries(req.query)) {
		if (param in params) {
			continue
		} else if (typeof value === "string") {
			try {
				params[param] = JSON.parse(value)
			} catch (err) {
				return res.status(StatusCodes.BAD_REQUEST).end(`Invalid query param value ${param}=${value}`)
			}
		}
	}

	if (req.headers.accept === "text/event-stream") {
		// subscription response
		res.setHeader("Cache-Control", "no-cache")
		res.setHeader("Content-Type", "text/event-stream")
		res.setHeader("Connection", "keep-alive")
		res.flushHeaders()

		let oldValues: Record<string, ModelValue>[] | null = null
		let closed = false
		const listener = () => {
			if (closed) {
				return
			}

			let newValues: Record<string, ModelValue>[]
			try {
				newValues = core.getRoute(route, params)
			} catch (err) {
				closed = true
				console.log(chalk.red("[canvas-cli] error evaluating route"), err)
				return res.status(StatusCodes.BAD_REQUEST).end(`Route error: ${err}`)
			}

			if (oldValues === null || !compareResults(oldValues, newValues)) {
				res.write(`data: ${JSON.stringify(newValues)}\n\n`)
				oldValues = newValues
			}
		}

		listener()
		core.addEventListener("action", listener)
		res.on("close", () => core.removeEventListener("action", listener))
	} else {
		// normal JSON response
		let data
		try {
			data = core.getRoute(route, params)
		} catch (err) {
			return res.status(StatusCodes.BAD_REQUEST).end(`Route error: ${err}`)
		}

		return res.json(data)
	}
}

function compareResults(a: Record<string, ModelValue>[], b: Record<string, ModelValue>[]) {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		for (const key in a[i]) {
			if (a[i][key] !== b[i][key]) {
				return false
			}
		}

		for (const key in b[i]) {
			if (b[i][key] !== a[i][key]) {
				return false
			}
		}
	}
}
