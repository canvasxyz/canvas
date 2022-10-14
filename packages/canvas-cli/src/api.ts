import http from "node:http"

import chalk from "chalk"
import stoppable from "stoppable"
import cors from "cors"
import express, { Request, Response } from "express"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"

import { Core, actionType, sessionType } from "@canvas-js/core"
import { ModelValue } from "@canvas-js/interfaces"

interface APIConfig {
	core: Core
	port: number
	verbose?: boolean
}

export class API {
	readonly core: Core
	readonly server: http.Server & stoppable.WithStop
	private readonly verbose?: boolean
	private readonly peerLoggingTimer?: NodeJS.Timer

	constructor({ core, port, verbose }: APIConfig) {
		this.core = core
		this.verbose = verbose

		const api = express()
		api.use(cors({ exposedHeaders: ["ETag", "Link"] }))
		api.use(bodyParser.json())

		api.head("/", (req, res) => {
			res.status(StatusCodes.OK)
			res.header("ETag", `"${core.cid.toString()}"`)
			res.header("Link", `<${core.uri}>; rel="self"`)
			res.header("Content-Type", "application/json")
			res.end()
		})

		api.get("/", (req: Request, res: Response) => {
			res.header("ETag", `"${core.cid.toString}"`)
			res.header("Link", `<${core.uri}>; rel="self"`)
			if (req.query.spec === "true") {
				res.json({ name: core.uri, spec: core.spec })
			} else {
				res.json({ name: core.uri })
			}
		})

		api.post("/actions", this.handleAction)
		api.post("/sessions", this.handleSession)

		for (const route of Object.keys(core.exports.routeParameters)) {
			api.get(route, this.getRouteHandler(route))
		}

		this.server = stoppable(
			api.listen(port, () => {
				console.log(`Serving ${core.uri} on port ${port}:`)
				console.log(`└ GET http://localhost:${port}/`)
				for (const name of Object.keys(core.exports.routeParameters)) {
					console.log(`└ GET http://localhost:${port}${name}`)
				}
				console.log("└ POST /actions")
				console.log("└ POST /sessions")
			}),
			0
		)
	}

	async stop() {
		clearInterval(this.peerLoggingTimer)

		await new Promise<void>((resolve, reject) => {
			this.server.stop((err) => (err ? reject(err) : resolve()))
		})
	}

	getRouteHandler = (route: string) => async (req: Request, res: Response) => {
		const params: Record<string, string> = {}
		for (const name of this.core.exports.routeParameters[route]) {
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
				const newData = this.core.getRoute(route, params)
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
			let data = undefined
			try {
				data = this.core.getRoute(route, params)
			} catch (err) {
				res.status(StatusCodes.BAD_REQUEST)
				return err instanceof Error ? res.end(`Route error: ${err.message}`) : res.end()
			}

			return res.status(StatusCodes.OK).json(data)
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
			.applyAction(action)
			.then(async ({ hash }) => {
				res.status(StatusCodes.OK).header("ETag", `"${hash}"`).end()
			})
			.catch((err) => {
				const message = err.message || err.internalError?.message
				console.error("[canvas-cli] Failed to apply action:", message)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(message || "Failed to apply action")
			})
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
			.applySession(session)
			.then(() => res.status(StatusCodes.OK).end())
			.catch((err) => {
				console.error("[canvas-cli] Failed to create session:", err)
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message)
			})
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
