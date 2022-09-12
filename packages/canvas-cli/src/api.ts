import http from "node:http"
import assert from "node:assert"

import chalk from "chalk"
import stoppable from "stoppable"
import cors from "cors"
import express, { Request, Response } from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"
import * as t from "io-ts"
import type { Message } from "@libp2p/interface-pubsub"
import type { EventCallback } from "@libp2p/interfaces/events"

import {
	Core,
	actionType,
	sessionType,
	encodeBinaryMessage,
	decodeBinaryMessage,
	getActionHash,
	getSessionHash,
} from "@canvas-js/core"
import { Action, ModelValue, Session } from "@canvas-js/interfaces"
import { IPFSHTTPClient } from "ipfs-http-client"

interface APIConfig {
	core: Core
	port: number
	ipfs?: IPFSHTTPClient
	peerID?: string
	peering?: boolean
	verbose?: boolean
}

export class API {
	readonly core: Core
	readonly peering: boolean
	readonly ipfs?: IPFSHTTPClient
	readonly topic?: string
	readonly peerID?: string
	readonly server: http.Server & stoppable.WithStop
	private readonly verbose?: boolean
	private readonly peerLoggingTimer?: NodeJS.Timer

	constructor({ peerID, core, port, ipfs, peering, verbose }: APIConfig) {
		this.core = core
		this.ipfs = ipfs
		this.peering = !!peering
		this.verbose = verbose

		if (ipfs !== undefined && this.peering) {
			this.topic = `canvas:${core.name}`
			this.peerID = peerID
			console.log(`[canvas-cli] Subscribing to pubsub topic ${this.topic}`)
			ipfs.pubsub.subscribe(this.topic, this.handleMessage).catch((err) => {
				console.log(chalk.red(`[canvas-cli] Failed to subscribe to pubsub topic: ${err}`))
			})

			if (verbose) {
				const peerLoggingTimeout = 10000
				this.peerLoggingTimer = setInterval(async () => {
					ipfs.pubsub
						.peers(this.topic!, { timeout: peerLoggingTimeout })
						.then((peerIds) => {
							console.log(`[canvas-cli] Connected to ${peerIds.length} pubsub peers`)
							for (const peerId of peerIds) {
								console.log(`[canvas-cli] - ${peerId.toString()}`)
							}
						})
						.catch((err) => {
							console.log(chalk.red("[canvas-cli] Failed to list pubsub peers"), err)
						})
				}, peerLoggingTimeout)
			}
		}

		const api = express()
		api.use(cors({ exposedHeaders: ["ETag"] }))
		api.use(bodyParser.json())

		api.head("/", (req, res) => {
			res.status(StatusCodes.OK)
			res.header("ETag", `"${core.name}"`)
			res.header("Content-Type", "application/json")
			res.end()
		})

		api.get("/", (req, res) => {
			res.header("ETag", `"${core.name}"`)
			res.json({ name: core.name })
		})

		api.post("/actions", this.handleAction)
		api.post("/sessions", this.handleSession)

		for (const route of Object.keys(core.routeParameters)) {
			api.get(route, this.getRouteHandler(route))
		}

		this.server = stoppable(
			api.listen(port, () => {
				console.log(`[canvas-cli] Serving ${core.name} on port ${port}:`)
				console.log(`└ GET http://localhost:${port}/`)
				for (const name of Object.keys(core.routeParameters)) {
					console.log(`└ GET http://localhost:${port}${name}`)
				}
				console.log("└ POST /actions")
				console.log(`  └ ${actionType.name}`)
				console.log(`  └ calls: [ ${Object.keys(core.actionParameters).join(", ")} ]`)
				console.log("└ POST /sessions")
				console.log(`  └ ${sessionType.name}`)
			}),
			0
		)
	}

	async stop() {
		clearInterval(this.peerLoggingTimer)

		if (this.peering && this.ipfs !== undefined && this.topic !== undefined) {
			console.log(`[canvas-cli] Unsubscribing from pubsub topic ${this.topic}`)
			await this.ipfs.pubsub
				.unsubscribe(this.topic, this.handleMessage)
				.catch((err) => console.error("[canvas-cli] Error while unsubscribing from pubsub topic", err))
		}

		await new Promise<void>((resolve, reject) => {
			this.server.stop((err) => (err ? reject(err) : resolve()))
		})
	}

	getRouteHandler = (route: string) => async (req: Request, res: Response) => {
		const params: Record<string, string> = {}
		for (const name of this.core.routeParameters[route]) {
			const value = req.params[name]
			if (typeof value === "string") {
				params[name] = value
			} else {
				res.status(StatusCodes.BAD_REQUEST)
				res.end(`Missing parameter "${name}"`)
				return
			}
		}

		if (req.headers.accept === "text/event-stream") {
			// subscription response
			res.setHeader("Cache-Control", "no-cache")
			res.setHeader("Content-Type", "text/event-stream")
			res.setHeader("Connection", "keep-alive")
			res.flushHeaders()

			let data: Record<string, ModelValue>[] | null = null
			const listener = async () => {
				const newData = await this.core.getRoute(route, params)
				if (data === null || !compareResults(data, newData)) {
					data = newData
					res.write(`data: ${JSON.stringify(data)}\n\n`)
				}
			}

			try {
				await listener()
			} catch (err) {
				// kill the EventSource if this.core.getRoute() fails on first request
				// TODO: is it possible that it succeeds now, but fails later with new `values`?
				console.error(chalk.red("[canvas-cli] error fetching view"), err)
				console.error(err)
				res.status(StatusCodes.BAD_REQUEST)
				res.end(`Route error: ${err}`)
				return
			}

			this.core.addEventListener("action", listener)
			res.on("close", () => this.core.removeEventListener("action", listener))
		} else {
			// normal JSON response
			this.core
				.getRoute(route, params)
				.then((data) => {
					res.status(StatusCodes.OK).json(data)
				})
				.catch((err) => {
					res.status(StatusCodes.BAD_REQUEST)
					res.end(`Route error: ${err}`)
				})
		}
	}

	handleAction = async (req: Request, res: Response) => {
		const action = req.body
		if (!actionType.is(action)) {
			if (this.verbose) {
				console.log(chalk.red(`[canvas-cli] Received invalid action`), action)
			} else {
				console.log(chalk.red(`[canvas-cli] Received invalid action`))
			}
			res.status(StatusCodes.BAD_REQUEST).end()
			return
		}

		await this.core
			.apply(action)
			.then(async ({ hash }) => {
				this.publishMessage(hash, action).catch((err) => {
					console.log(chalk.red("[canvas-cli] Failed to publish message to pubsub"), err)
				})

				res.status(StatusCodes.OK).header("ETag", `"${hash}"`).end()
			})
			.catch((err) => {
				const message = err.message || err.internalError?.message
				console.error("[canvas-cli] Failed to apply action:", message)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message || "Failed to apply action")
			})
	}

	private async publishMessage(actionHash: string, action: Action) {
		if (this.peering && this.ipfs !== undefined && this.topic !== undefined) {
			let message: Uint8Array
			if (action.session !== null) {
				const { hash: sessionHash, session } = await this.core.messageStore.getSessionByAddress(action.session)
				assert(sessionHash !== null && session !== null)
				message = encodeBinaryMessage({ hash: actionHash, action }, { hash: sessionHash, session })
			} else {
				message = encodeBinaryMessage({ hash: actionHash, action }, { hash: null, session: null })
			}

			await this.ipfs.pubsub.publish(this.topic, message).catch((err) => {
				console.error(chalk.red("[canvas-cli] Failed to publish action to pubsub topic"), err)
			})
		}
	}

	handleSession = async (req: Request, res: Response) => {
		const session = req.body
		if (!sessionType.is(session)) {
			if (this.verbose) {
				console.error(chalk.red(`[canvas-cli] Received invalid session`), session)
			} else {
				console.error(chalk.red(`[canvas-cli] Received invalid session`))
			}

			res.status(StatusCodes.BAD_REQUEST).end()
			return
		}

		// Since we republish all session with each action, we just skip sending sessions
		// over pubsub entirely.
		await this.core
			.session(session)
			.then(() => res.status(StatusCodes.OK).end())
			.catch((err) => {
				console.error("[canvas-cli] Failed to create session:", err)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
	}

	handleMessage: EventCallback<Message> = async (event) => {
		if (event.type !== "signed" || event.from.toString() === this.peerID) {
			return
		}

		if (this.verbose) {
			console.log(`[canvas-cli] Reveived pubsub message from peer ${event.from.toString()}`)
		}

		let decodedMessage: ReturnType<typeof decodeBinaryMessage>
		try {
			decodedMessage = decodeBinaryMessage(event.data)
		} catch (err) {
			console.error(chalk.red("[canvas-cli] Failed to parse pubsub message"), err)
			return
		}

		const { action, session } = decodedMessage
		try {
			if (session !== null) {
				await this.core.session(session)
			}

			await this.core.apply(action)
		} catch (err) {
			console.log(chalk.red("[canvas-cli] Error applying peer message"), err)
		}
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
