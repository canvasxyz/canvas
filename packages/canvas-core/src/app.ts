import fs from "fs"
import path from "path"
import assert from "assert"
import crypto from "crypto"
import { Worker, MessageChannel, MessagePort } from "worker_threads"
import type net from "net"
import type http from "http"

import type express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import { StatusCodes } from "http-status-codes"

import hypercore, { Feed } from "hypercore"
import Database, * as sqlite from "better-sqlite3"
import { ethers } from "ethers"
import * as t from "io-ts"

import { IPFSHTTPClient, create as createIPFSHTTPClient } from "ipfs-http-client"

import { Model, getColumnType } from "./models.js"
import {
	Action,
	actionType,
	actionPayloadType,
	Session,
	SessionPayload,
	sessionType,
	sessionPayloadType,
} from "./actions.js"

const actionMessage = t.union([
	t.type({ id: t.string, status: t.literal("success") }),
	t.type({ id: t.string, status: t.literal("failure"), error: t.string }),
])

const modelMessage = t.type({
	timestamp: t.number,
	name: t.string,
	id: t.string,
	value: t.record(t.string, t.union([t.null, t.number, t.string, t.boolean])),
})

// Don't use the App constructor directly, use the static App.initialize method instead
export class App {
	static async initialize(options: { path: string; multihash: string; port?: number; ipfs?: IPFSHTTPClient }) {
		const ipfs = options.ipfs || createIPFSHTTPClient()
		const handle = options.port || path.resolve(options.path, "api.sock")

		// App.initialize does the preliminary *async* tasks of starting an app:
		// - creating the app directory and copying spec.js if necessary
		// - creating the sqlite database
		// - creating the hypercore feed and awaiting its "ready" event
		// - creating the worker, posting the initialization message, and awaiting the response

		// AFTER all of these are done, we're left with a bunch of values that we
		// pass into the app constructor, which then does the remaining synchronous
		// initialization work:
		// - initializing the database schema
		// - preparing the model and action statements
		// - attaching listeners to the message ports.

		console.log("initializing", options.multihash)
		const { pathname } = new URL(import.meta.url)
		const workerPath = path.resolve(pathname, "..", "../worker.js")

		// create directory at appPath if it doesn't exist already
		const appPath = path.resolve(options.path)
		if (!fs.existsSync(appPath)) {
			fs.mkdirSync(appPath)
		}

		// write spec.js and spec.cid if they don't exist already
		const specPath = path.resolve(appPath, "spec.mjs")
		const specCidPath = path.resolve(appPath, "spec.cid")
		if (fs.existsSync(specPath) && fs.existsSync(specCidPath)) {
			const cid = fs.readFileSync(specCidPath, "utf-8")
			assert(cid === options.multihash, "could not launch app: spec.cid did not match options.multihash")
		} else {
			await fs.promises.writeFile(specPath, ipfs.cat(options.multihash), { encoding: "utf-8" })
			await fs.promises.writeFile(specCidPath, options.multihash, { encoding: "utf-8" })
		}

		// Remove the api socket, if it exists
		const apiPath = path.resolve(appPath, "api.sock")
		if (fs.existsSync(apiPath)) {
			fs.unlinkSync(apiPath)
		}

		const worker = new Worker(workerPath)
		const actionChannel = new MessageChannel()
		const modelChannel = new MessageChannel()

		const { routes, models, actionParameters } = await new Promise((resolve, reject) => {
			// The order of these next two blocks (attaching the message handler
			// and posting the initial message) is logically important.
			worker.once("message", (message) => {
				console.log("received initialization response from worker", options.multihash, message.status)
				if (message.status === "success") {
					const { routes, models, actionParameters } = message
					resolve({ routes, models, actionParameters })
				} else {
					reject(new Error(message.error))
				}
			})

			console.log("posting initialization message", options.multihash)
			worker.postMessage(
				{
					path: specPath,
					actionPort: actionChannel.port1,
					modelPort: modelChannel.port1,
				},
				[actionChannel.port1, modelChannel.port1]
			)
		})

		const hypercorePath = path.resolve(appPath, "hypercore")
		const feed = hypercore(hypercorePath, {
			createIfMissing: true,
			overwrite: false,
			valueEncoding: "json",
		})

		await new Promise<void>((resolve) => feed.on("ready", () => resolve()))

		const databasePath = path.resolve(appPath, "db.sqlite")
		const database = new Database(databasePath)

		return new App(
			options.multihash,
			database,
			feed,
			worker,
			actionChannel.port2,
			modelChannel.port2,
			routes,
			models,
			actionParameters,
			handle
		)
	}

	private readonly statements: {
		routes: Record<string, sqlite.Statement>
		models: Record<string, { set: sqlite.Statement }>
		sessions: { add: sqlite.Statement }
	}

	private readonly callPool: Map<string, { resolve: () => void; reject: (err: Error) => void }> = new Map()

	private api?: express.Express
	private server?: http.Server
	private readonly connections: Set<net.Socket> = new Set()

	public sessions: Session[] = []

	private constructor(
		readonly multihash: string,
		readonly database: sqlite.Database,
		readonly feed: Feed,
		readonly worker: Worker,
		readonly actionPort: MessagePort,
		readonly modelPort: MessagePort,
		readonly routes: Record<string, string>,
		readonly models: Record<string, Model>,
		readonly actionParameters: Record<string, string[]>,
		readonly handle: number | string
	) {
		// Initialize the database schema
		const tables: string[] = []

		for (const [name, model] of Object.entries(this.models)) {
			const columns = ["id TEXT PRIMARY KEY NOT NULL", "timestamp INTEGER NOT NULL"]
			for (const field of Object.keys(model)) {
				assert(field !== "id" && field !== "timestamp", "fields can't be named 'id' or 'timestamp'")
				columns.push(`${field} ${getColumnType(model[field])}`)
			}

			tables.push(`CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")});`)
		}
		tables.push(
			"CREATE TABLE IF NOT EXISTS _sessions " +
				"(session_public_key TEXT PRIMARY KEY NOT NULL, origin TEXT NOT NULL, " +
				"signature TEXT NOT NULL, payload TEXT NOT NULL);"
		)

		this.database.exec(tables.join("\n"))

		// Prepare session archive statements
		const addSession = this.database.prepare(
			"INSERT INTO _sessions (origin, signature, payload, session_public_key) " +
				"VALUES (:from, :signature, :payload, :session_public_key)"
		)

		this.statements = {
			routes: {},
			models: {},
			sessions: { add: addSession },
		}

		// Prepare route statements
		for (const [name, route] of Object.entries(this.routes)) {
			this.statements.routes[name] = this.database.prepare(route)
		}

		// Prepare model statements
		for (const [name, model] of Object.entries(this.models)) {
			// This assumes that the iteration order here with Object.keys(model)
			// is the exact same as we had previously in Object.entries(models).
			// This is true and guaranteed but not great practice.
			const keys = ["timestamp", ...Object.keys(model)]
			const fields = keys.join(", ")
			const params = keys.map((key) => `:${key}`).join(", ")
			const condition = (n: string) => `${n} = CASE WHEN timestamp < :timestamp THEN :${n} ELSE ${n} END`
			const updates = keys.map(condition).join(", ")
			this.statements.models[name] = {
				set: this.database.prepare(
					`INSERT INTO ${name} (id, ${fields}) VALUES (:id, ${params}) ON CONFLICT (id) DO UPDATE SET ${updates}`
				),
			}
		}

		// Restore sessions from archive table
		const sessions = this.database
			.prepare("SELECT origin AS 'from', signature, payload, session_public_key FROM _sessions")
			.all()
		sessions.forEach((session) => {
			if (!sessionType.is(session)) {
				console.log("Skipped invalid archived session:", session)
				return
			}
			this.sessions.push(session)
		})

		// Attach model message listener
		this.modelPort.on("message", (message) => {
			this.handleModelMessage(message)
		})

		// Attach action message listener
		this.actionPort.on("message", (message) => {
			this.handleActionMessage(message)
		})

		// Create the API server
		import("express")
			.then(({ default: express }) => {
				this.api = express()
				if (this.api === null || this.api === undefined) return // TODO: remove this line

				this.api.use(cors())
				this.api.use(bodyParser.json())

				for (const route of Object.keys(this.routes)) {
					this.api.get(route, (req, res) => {
						const results = this.statements.routes[route].all(req.params)
						res.status(StatusCodes.OK).json(results)
					})
				}

				this.api.post(`/action`, async (req, res) => {
					if (!actionType.is(req.body)) {
						return res.status(StatusCodes.BAD_REQUEST).end()
					}
					await this.apply(req.body)
						.then(() => res.status(StatusCodes.OK).end())
						.catch((err) => res.status(StatusCodes.INTERNAL_SERVER_ERROR).end(err.message))
				})

				this.server = this.api.listen(handle, () => {
					console.log("API server listening on", handle)
				})

				// we need to explicitly track open connections
				// in order to shut the api server down gracefully
				this.server.on("connection", (socket) => {
					this.connections.add(socket)
					socket.on("close", () => this.connections.delete(socket))
				})
			})
			.catch((error) => {
				console.log("Could not import express, skipping server binding")
			})
	}

	private handleModelMessage(message: any) {
		// TODO: this validation should really happen in two stages since message
		// contains a mix of spec-provided and worker-provided data. if the worker-
		// provided data is invalid we should throw, but if the spec-provided data
		// is invalid we should try to find the call pool callback and reject it.
		if (!modelMessage.is(message)) {
			console.error(message)
			throw new Error("internal error: received invalid model message from worker")
		}

		const { timestamp, name, id, value } = message
		try {
			assert(name in this.statements.models, `${JSON.stringify(name)} is not a model name`)
			const model = this.statements.models[name]
			model.set.run({ ...value, id, timestamp })
		} catch (err) {
			const call = this.callPool.get(message.id)
			if (call === undefined) {
				// TODO: since these messages are coming from the worker thread there's
				// actually a chance that the handler in the worker exits successfully
				// and the call in the call pool gets resolved *before* we actually process
				// the view state side effects on modelPort...
				throw new Error("internal error: message callbacks missing from call pool")
			}

			// However in the case that we do catch an error we would prefer to reject the
			// .apply promise instead of throwing inside .handleModelMessage (crashes the app)
			call.reject(err instanceof Error ? err : new Error((err as any).toString()))
		}
	}

	private handleActionMessage(message: any) {
		if (!actionMessage.is(message)) {
			console.error(message)
			throw new Error("internal error: received invalid action message from worker")
		}

		const call = this.callPool.get(message.id)
		if (call === undefined) {
			throw new Error("internal error: message callbacks missing from call pool")
		}

		this.callPool.delete(message.id)
		if (message.status === "success") {
			call.resolve()
		} else {
			call.reject(new Error(message.error))
		}
	}

	/**
	 * 1. stop accepting new actions and queries
	 * 2. reject in-process calls in the call pool
	 * 3.
	 */
	async stop() {
		await new Promise<void>((resolve, reject) => {
			// TODO: it's okay to throw an exception on stop() if this core
			// is running in the browser, but we should be more explicit about it
			if (this.server === null || this.server === undefined) {
				reject()
				return
			}
			// http.Server.close() stops new incoming connections
			// but keeps existing ones open. the callback is only
			// called when all connections are closed .
			this.server.close((err) => (err ? reject(err) : resolve()))

			// reject calls in the action pool
			for (const call of this.callPool.values()) {
				call.reject(new Error("app was shut down before action resolved"))
			}

			// close open connections on the API server
			// (this needs to happen here inside the promise executor)
			this.connections.forEach((socket) => socket.end())
			this.connections.clear()
		})

		// terminate the worker thread
		await this.worker.terminate()

		// close the hypercore feed
		await new Promise<void>((resolve, reject) => this.feed.close((err) => (err ? reject(err) : resolve())))

		// close the sqlite database
		this.database.close()
	}

	/**
	 * Create a new session.
	 */
	async session(session: Session) {
		const payload = JSON.parse(session.payload)
		assert(sessionType.is(session), "invalid session")
		assert(sessionPayloadType.is(payload), "invalid session payload")
		assert(payload.from === session.from, "session signed by wrong address")
		assert(payload.spec === this.multihash, "session signed for wrong spec")

		const verifiedAddress = ethers.utils.verifyMessage(session.payload, session.signature)
		assert(session.from === verifiedAddress, "session signed by wrong address")

		this.sessions.push(session)
		this.statements.sessions.add.run({ ...session })
	}

	/**
	 * Apply an action.
	 * There may be many outstanding actions, and actions are not guaranteed to execute in order.
	 */
	async apply(action: Action) {
		assert(actionType.is(action), "invalid action")
		// Verify the action matches the payload
		const payload = JSON.parse(action.payload)
		assert(actionPayloadType.is(payload), "invalid message payload")

		/**
		 * Verify the action signature.
		 *
		 * If the action is signed by a session key, then:
		 *  - `action.from` and `payload.from` and `session.from` are the key used to generate the session
		 *  - `action.session` and `session.session_public_key` are the key used to sign the payload
		 * It is assumed that any session found in `this.sessions` is valid.
		 */
		if (action.session !== null) {
			const session = this.sessions.find((s) => s.session_public_key === action.session)

			assert(session !== undefined, "action signed by invalid session")
			assert(action.from === payload.from, "action signed by invalid session")
			assert(action.from === session.from, "action signed by invalid session")
			assert(action.session === session.session_public_key, "action signed by invalid session")
			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(action.session === verifiedAddress, "action signed by invalid session")
		} else {
			assert(action.from === payload.from, "action signed by wrong address")
			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(action.from === verifiedAddress, "action signed by wrong address")
		}

		assert(payload.spec === this.multihash, "action signed for wrong spec")
		assert(payload.call !== "", "attempted to call an empty action")
		assert(payload.call in this.actionParameters, "attempted to call an invalid action")

		const id = crypto.createHash("sha256").update(action.signature).digest("hex")

		// Await response from worker
		await new Promise<void>((resolve, reject) => {
			this.callPool.set(id, { resolve, reject })
			this.actionPort.postMessage({ id, action: payload })
		})

		// Append to hypercore
		await new Promise<void>((resolve, reject) => {
			this.feed.append(action, (err, seq) => {
				console.log("appended to hypercore", seq)
				if (err === null) {
					resolve()
				} else {
					reject(err)
				}
			})
		})
	}
}
