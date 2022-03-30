import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"
import { Worker, MessageChannel, MessagePort } from "node:worker_threads"

import express from "express"
import hypercore, { Feed } from "hypercore"
import Database, * as sqlite from "better-sqlite3"
import * as t from "io-ts"
import { ethers } from "ethers"

import type { Action, ActionPayload, Model } from "./types"
import { getColumnType } from "./models"

const appDirectory = process.env.APP_DIRECTORY!

if (typeof appDirectory !== "string") {
	throw new Error("Missing APP_DIRECTORY env variable from .env file")
}

if (!fs.existsSync(appDirectory)) {
	fs.mkdirSync(appDirectory)
}

const actionMessage = t.union([
	t.type({ id: t.number, status: t.literal("success") }),
	t.type({ id: t.number, status: t.literal("failure"), error: t.string }),
])

const modelMessage = t.type({
	id: t.number,
	name: t.string,
	params: t.record(t.string, t.union([t.null, t.number, t.string, t.boolean])),
})

// Don't use the App constructor directly, use the static App.initialize method instead:
// const app = await App.initialize(multihash, spec)
export class App {
	static async initialize(multihash: string, spec: string): Promise<App> {
		// App.initialize does the preiminary *async* tasks of starting an app:
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

		// create the app path in the app directory if it doesn't exists,
		// and writes the spec file from IPFS to ${APP_DIRECTORY}/[multihash]/spec.js.
		const appPath = path.resolve(appDirectory, multihash)
		const specPath = path.resolve(appPath, "spec.js")
		if (!fs.existsSync(appPath)) {
			fs.mkdirSync(appPath)
		}

		fs.writeFileSync(specPath, spec)

		const databasePath = path.resolve(appPath, "db.sqlite")
		const database = new Database(databasePath)

		const hypercorePath = path.resolve(appPath, "hypercore")
		const feed = hypercore(hypercorePath, {
			createIfMissing: true,
			overwrite: false,
			valueEncoding: "json",
		})

		await new Promise<void>((resolve) => feed.on("ready", () => resolve()))

		const worker = new Worker(path.resolve("worker.js"))
		const actionChannel = new MessageChannel()
		const modelChannel = new MessageChannel()

		const { routes, models, actionParameters } = await new Promise((resolve, reject) => {
			// The order of these next two blocks (attaching the message handler
			// and posting the initial message) is logically important.
			worker.once("message", ({ routes, models, actionParameters }) => {
				// TODO: validate routes and models
				resolve({ routes, models, actionParameters })
			})

			worker.postMessage(
				{
					multihash: multihash,
					actionPort: actionChannel.port1,
					modelPort: modelChannel.port1,
				},
				[actionChannel.port1, modelChannel.port1]
			)
		})

		return new App(
			multihash,
			database,
			feed,
			worker,
			actionChannel.port2,
			modelChannel.port2,
			routes,
			models,
			actionParameters
		)
	}

	private readonly routeStatements: Record<string, sqlite.Statement> = {}
	private readonly modelStatements: Record<string, sqlite.Statement> = {}
	private readonly actionPool: Map<number, { resolve: () => void; reject: (err: Error) => void }> = new Map()
	private actionId = 0

	private readonly server: express.Express

	private constructor(
		readonly multihash: string,
		readonly database: sqlite.Database,
		readonly feed: Feed,
		readonly worker: Worker,
		readonly actionPort: MessagePort,
		readonly modelPort: MessagePort,
		readonly routes: Record<string, string>,
		readonly models: Record<string, Model>,
		readonly actionParameters: Record<string, string[]>
	) {
		// Initialize the database schema
		const tables: string[] = []

		for (const [name, model] of Object.entries(this.models)) {
			const columns = ["id TEXT PRIMARY KEY NOT NULL"]
			for (const field of Object.keys(model)) {
				columns.push(`${field} ${getColumnType(model[field])}`)
			}

			tables.push(`CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")});`)
		}

		this.database.exec(tables.join("\n"))

		// Prepare route statements
		for (const [name, route] of Object.entries(this.routes)) {
			this.routeStatements[name] = this.database.prepare(route)
		}

		// Prepare model statements
		for (const [name, model] of Object.entries(this.models)) {
			// This assumes that the iteration order here with Object.keys(model)
			// is the exact same as we had previously in Object.entries(models).
			// This is true and guaranteed but not great practice.
			const fields = Object.keys(model).join(", ")
			const params = Object.keys(model)
				.map((f) => `:${f}`)
				.join(", ")
			this.modelStatements[name] = this.database.prepare(`INSERT INTO ${name} (id, ${fields}) VALUES (:id, ${params})`)
		}

		// Attach model message listener
		this.modelPort.on("message", (message) => this.handleModelMessage(message))

		// Attach action message listener
		this.actionPort.on("message", (message) => this.handleActionMessage(message))

		// Remove the api socket, if it exists
		const apiPath = path.resolve(appDirectory, this.multihash, "api.sock")
		if (fs.existsSync(apiPath)) {
			fs.unlinkSync(apiPath)
		}

		// Create the API server
		this.server = express()
		this.server.get("/", (req, res) => {
			console.log("handling api request")
			res.send("hello world 2")
		})

		this.server.get("/route/:name", (req, res) => {
			console.log(req.params.name)
			// req.body
		})

		this.server.listen(apiPath, () => {
			console.log("API server listening on socket", apiPath)
		})
	}

	private handleModelMessage(message: any) {
		if (modelMessage.is(message)) {
			assert(message.name in this.modelStatements)
			console.log("inserting into models!", message.name, message.params)
			// TODO: validate params
			this.modelStatements[message.name].run({ id: message.id, ...message.params })
		} else {
			console.error("unexpected model message", message)
		}
	}

	private handleActionMessage(message: any) {
		if (actionMessage.is(message)) {
			const promise = this.actionPool.get(message.id)
			if (promise === undefined) {
				throw new Error("internal error: missing promise callbacks for action response")
			}

			this.actionPool.delete(message.id)
			if (message.status === "success") {
				promise.resolve()
			} else {
				promise.reject(new Error(message.error))
			}
		} else {
			console.error("unexpected action message", message)
		}
	}

	async stop() {
		await this.worker.terminate()
		await new Promise<void>((resolve, reject) => {
			this.feed.close((err) => (err === null ? resolve() : reject(err)))
		})
		this.database.close()
	}

	async apply(action: Action) {
		try {
			await new Promise<void>((resolve, reject) => {
				const id = this.actionId++

				// Verify the action matches the payload
				const payload = JSON.parse(action.payload)
				assert(action.from === payload.from, "action origin doesn't match payload origin")
				assert(action.chainId === payload.chainId, "action chainId doesn't match payload chainId")

				// Verify the signature
				const verifiedAddress = ethers.utils.verifyMessage(payload, action.signature)
				assert(action.from === verifiedAddress, "action signed by wrong address")

				// There may be many outstanding actions, and actions are not guaranteed to execute in order.
				this.actionPool.set(id, { resolve, reject })
				this.actionPort.postMessage({ id, action: payload })
			})
		} catch (err) {
			console.log(err)
			throw err
		}

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
