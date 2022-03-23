import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"
import { Worker, MessageChannel, MessagePort } from "node:worker_threads"
import { prisma } from "utils/server/services"

import hypercore, { Feed } from "hypercore"
import Database, * as sqlite from "better-sqlite3"

import type { Action, Model } from "./types"
import { ipfs } from "utils/server/services"
import { getColumnType } from "./models"

interface App {
	routes: Record<string, string>
	routeStatements: Record<string, sqlite.Statement>
	models: Record<string, Model>
	modelStatements: Record<string, sqlite.Statement>
	actionParameters: Record<string, string[]>
	worker: Worker
	hypercore: Feed
	actionPort: MessagePort
	modelPort: MessagePort
}

/**
 * A Loader holds and manages the worker threads running apps.
 * There's only one loader instance for the whole hub.
 */
export class Loader {
	public readonly apps: Record<string, App> = {}

	// TODO: actually generate IDs for real
	private actionId = 0
	private actionResponsePool: Map<
		number,
		{ resolve: () => void; reject: (err: Error) => void }
	> = new Map()

	constructor() {
		console.log("initializing loader")
		if (process.env.APP_DIRECTORY === undefined) {
			throw new Error("Missing APP_DIRECTORY environment variable from .env")
		}

		prisma.app
			.findMany({
				select: {
					id: true,
					last_version: { select: { version_number: true, multihash: true } },
				},
			})
			.then((apps) => {
				return Promise.all(
					apps.map(({ last_version }) => {
						if (!last_version) return
						console.log(last_version.multihash)
						return this.startApp(last_version.multihash)
					})
				)
			})
	}

	/**
	 * creates the app path in the app directory if it doesn't exists,
	 * and writes the spec file from IPFS to ${APP_DIRECTORY}/[multihash]/spec.js.
	 *
	 * This returns false if the app already exists, and true otherwise.
	 * The return value here will be passed in the initial message to worker.js.
	 */
	private async initializeAppDirectory(multihash: string): Promise<boolean> {
		const appPath = path.resolve(process.env.APP_DIRECTORY!, multihash)
		const specPath = path.resolve(appPath, "spec.js")
		if (fs.existsSync(appPath)) {
			return false
		} else {
			fs.mkdirSync(appPath)
			await fs.promises.writeFile(specPath, ipfs.cat(multihash))

			return true
		}
	}

	public async startApp(multihash: string): Promise<void> {
		const create = await this.initializeAppDirectory(multihash)

		const databasePath = path.resolve(
			process.env.APP_DIRECTORY!,
			multihash,
			"db.sqlite"
		)
		const database = new Database(databasePath)

		const feed = await new Promise<Feed>((resolve, reject) => {
			const hypercorePath = path.resolve(
				process.env.APP_DIRECTORY!,
				multihash,
				"hypercore"
			)
			const feed = hypercore(hypercorePath, { valueEncoding: "binary" })
			feed.on("ready", () => resolve(feed))
		})

		this.apps[multihash] = await new Promise((resolve, reject) => {
			const worker = new Worker(path.resolve("worker.js"))
			const actionChannel = new MessageChannel()
			const modelChannel = new MessageChannel()

			// The order of these next two blocks (attaching the message handler
			// and posting the initial message) is logically important.
			worker.once("message", ({ routes, models, actionParameters }) => {
				// Now that we have the parsed exports of the spec file, we use them
				// to initialize the database schema (if necessary) and prepare statements
				// for route queries and model creation.

				// TODO: validate routes and models

				// It's a little awkward to do it like this but it's only here that we have
				// all the necessary data in the same place.
				if (create) {
					const tables: string[] = []

					for (const [name, model] of Object.entries<Model>(models)) {
						const columns = ["_id TEXT PRIMARY KEY NOT NULL"]
						for (const field of Object.keys(model)) {
							columns.push(`${field} ${getColumnType(model[field])}`)
						}

						tables.push(`CREATE TABLE ${name} (${columns.join(", ")});`)
					}

					database.exec(tables.join("\n"))
				}

				const routeStatements: Record<string, sqlite.Statement> = {}
				for (const [name, route] of routes) {
					routeStatements[name] = database.prepare(route)
				}

				const modelStatements: Record<string, sqlite.Statement> = {}
				for (const [name, model] of models) {
					// This assumes that the iteration order here with Object.keys(model)
					// is the exact same as we had previously in Object.entries(models).
					// This is true and guaranteed but not great practice.
					const params = Object.keys(model).map((field) => `:${field}`)
					modelStatements[name] = database.prepare(
						`INSERT INTO ${name} VALUES (:_id, ${params.join(", ")})`
					)
				}

				modelChannel.port1.on("message", ({ id, name, params }) => {
					assert(name in modelStatements)
					// TODO: validate params
					modelStatements[name].run({ _id: id, ...params })
				})

				actionChannel.port1.on("message", ({ id, status, message }) => {
					assert(this.actionResponsePool.has(id))
					const { resolve, reject } = this.actionResponsePool.get(id)!
					if (status === "success") {
						resolve()
					} else {
						reject(new Error(message))
					}
				})

				resolve({
					routes,
					routeStatements,
					models,
					modelStatements,
					actionParameters,
					hypercore: feed,
					worker,
					actionPort: actionChannel.port2,
					modelPort: modelChannel.port2,
				})
			})

			worker.postMessage(
				{
					multihash,
					actionPort: actionChannel.port1,
					modelPort: modelChannel.port1,
				},
				[actionChannel.port1, modelChannel.port1]
			)
		})
	}

	public async stopApp(multihash: string): Promise<void> {
		await this.apps[multihash].worker.terminate()
		delete this.apps[multihash]
	}

	public applyAction(multihash: string, action: Action): Promise<void> {
		assert(multihash in this.apps)
		return new Promise((resolve, reject) => {
			const id = this.actionId++
			this.actionResponsePool.set(id, { resolve, reject })
			this.apps[multihash].actionPort.postMessage({ id, action })
		})
	}

	public queryRoute(
		multihash: string,
		name: string,
		params: Record<string, string>
	) {
		assert(multihash in this.apps)
		const app = this.apps[multihash]
		assert(name in app.routeStatements)

		// TODO: validate params
		return app.routeStatements[name].all(params)
	}
}

// const alphanumeric = /^[a-zA-Z0-9]+$/
// const routePattern = /^(\/:?[a-zA-Z0-9]+)+$/
