import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"
import { MessagePort, parentPort } from "node:worker_threads"

import Database from "better-sqlite3"
import hypercore from "hypercore"

import * as IpfsHttpClient from "ipfs-http-client"

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const dataDirectory = process.env.DATA_DIRECTORY
if (dataDirectory === undefined) {
	throw new Error("Missing DATA_DIRECTORY environment variable from .env.local")
}

// connect to the default API address http://localhost:5001
const ipfs = IpfsHttpClient.create()

/**
 * https://nodejs.org/dist/latest-v16.x/docs/api/worker_threads.html#class-worker
 * The nodejs docs recommend instantiating multiple MessagePorts for "separation
 * of concerns", and only using the main "global" port for setting them up in the
 * beginning.
 *
 * Here we create two ports: actionPort for actions, and controlPort for thread
 * lifecycle methods.
 */

parentPort.once("message", async ({ multihash, actionPort, queryPort }) => {
	assert(actionPort instanceof MessagePort)
	assert(queryPort instanceof MessagePort)

	const app = await new App(multihash).initialize()

	actionPort.on("message", (value) => {
		// do something with value
		actionPort.postMessage({ status: "success" })
	})

	queryPort.on("message", ({ route, params }) => {
		// do something with value
		actionPort.postMessage({ status: "success", result: {} })
	})

	parentPort.postMessage({ status: "success" })
})

/**
 * An App instance holds all of the imported data of a spec, some local
 * state/optimizations/cache stuff like a prepared sqlite3.Statement for every
 * route query, and the running hypercore feed for the app's actions.
 */

class App {
	constructor(multihash) {
		this.multihash = multihash
	}

	async initialize() {
		const createDatadir = !fs.existsSync(dataDirectory)
		if (createDatadir) {
			fs.mkdirSync(dataDirectory)
		}

		const appPath = path.resolve(dataDirectory, this.multihash)
		const specPath = path.resolve(appPath, "spec.js")

		const create = !fs.existsSync(appPath)
		if (create) {
			fs.mkdirSync(appPath)
			await fs.promises.writeFile(specPath, ipfs.cat(this.multihash))
		}

		const databasePath = path.resolve(appPath, "db.sqlite")
		this.database = new Database(databasePath)
		this.database.pragma("foreign_keys = ON", { simple: true })

		// Dynamically import the file!!
		const { actions, models, routes } = await import(specPath)
		this.validateActions(actions)
		this.validateModels(models)
		this.validateRoutes(routes)

		if (create) {
			this.initializeDatabaseSchema()
		} else {
			this.validateDatabaseSchema()
		}

		const hypercorePath = path.resolve(appPath, "hypercore")
		this.hypercore = hypercore(hypercorePath, { valueEncoding: "binary" })

		await new Promise((resolve, reject) =>
			this.hypercore.on("ready", () => resolve())
		)

		return this
	}

	validateActions(actions) {
		this.actions = {}
		this.actionParameters = {}
		for (const [name, handler] of Object.entries(actions)) {
			assert(alphanumeric.test(name), "action name must be alphanumeric")
			if (typeof handler !== "function") {
				throw new Error("action handler must be a function")
			}

			this.actions[name] = handler
			this.actionParameters[name] = App.parseHandlerParameters(handler)
		}
	}

	validateModels(models) {
		this.models = {}
		for (const [name, model] of Object.entries(models)) {
			assert(alphanumeric.test(name), "model name must be alphanumeric")
			this.models[name] = model
		}
	}

	validateRoutes() {
		this.routes = {}
		for (const [name, route] of Object.entries(routes)) {
			assert(alphanumeric.test(name), "route name must be alphanumeric")
			// TODO: validate route query (???)
			this.routes[name] = this.database.prepare(route)
		}
	}

	initializeDatabaseSchema() {
		const tables = []
		for (const [modelName, model] of Object.entries(this.models)) {
			const columns = ["_id TEXT PRIMARY KEY NOT NULL"]
			for (const [fieldName, fieldType] of Object.entries(model)) {
				assert(alphanumeric.test(fieldName), "field name must be alphanumeric")
				columns.push(`${fieldName} ${Spec.getColumnType(fieldType)}`)
			}

			tables.push(`CREATE TABLE ${modelName} (${columns.join(", ")});`)
		}

		this.database.exec(tables.join("\n"))

		this.db = {}
		for (const [modelName, model] of Object.entries(this.models)) {
			const fields = Object.keys(model).map((field) => `:${field}`)
			const statement = this.database.prepare(
				`INSERT INTO ${modelName} VALUES (:_id, ${fields.join(", ")})`
			)

			this.db[modelName] = Object.freeze({
				create(args) {
					for (const [fieldName, fieldType] of Object.entries(model)) {
						const value = args[fieldName]
						assert(value !== undefined, `missing value for field ${fieldName}`)
						Spec.validateType(fieldType, value)
					}

					for (const name of Object.keys(args)) {
						assert(name in model, `extraneous argument ${name}`)
					}

					statement.run(args)
				},
			})
		}

		Object.freeze(this.db)
	}

	validateDatabaseSchema() {
		// TODO: implement this maybe
	}

	// Action methods

	// Static utility methods

	static validateType(type, value) {
		if (type === "boolean") {
			assert(typeof value === "boolean", "invalid type: expected boolean")
		} else if (type === "string") {
			assert(typeof value === "string", "invalid type: expected string")
		} else if (type === "integer") {
			assert(Number.isSafeInteger(value), "invalid type: expected integer")
		} else if (type === "float") {
			assert(typeof value === "number", "invalid type: expected number")
		} else if (type === "bytes") {
			assert(value instanceof Uint8Array, "invalid type: expected Uint8Array")
		} else if (type === "datetime") {
			assert(value instanceof Date, "invalid type: expected Date")
		} else {
			// reference values are represented as strings
			assert(typeof value === "string", "invalid type: expected string")
		}
	}

	static getColumnType(field) {
		switch (field) {
			case "boolean":
				return "INTEGER"
			case "string":
				return "TEXT"
			case "integer":
				return "INTEGER"
			case "float":
				return "FLOAT"
			case "bytes":
				return "BLOB"
			case "datetime":
				return "TEXT"
			default:
				const [_, tableName] = match(
					field,
					/^@([a-z0-9]+)$/,
					"invalid field type"
				)

				return `TEXT NOT NULL REFERENCES ${tableName}(_id)`
		}
	}

	// https://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically
	static parseHandlerParameters(handler) {
		return handler
			.toString()
			.replace(/[/][/].*$/gm, "") // strip single-line comments
			.replace(/\s+/g, "") // strip white space
			.replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
			.split("){", 1)[0]
			.replace(/^[^(]*[(]/, "") // extract the parameters
			.replace(/=[^,]+/g, "") // strip any ES6 defaults
			.split(",")
			.filter(Boolean) // split & filter [""]
	}
}

const alphanumeric = /^[a-zA-Z0-9]+$/
