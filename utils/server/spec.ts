import Database, * as sqlite3 from "better-sqlite3"
import hypercore, { Feed } from "hypercore"

import { assert, match } from "utils/server/assert"
import type {
	Model,
	ModelType,
	ActionHandler,
	ContextModel,
	ModelValue,
	Action,
} from "./types"

export interface SpecConstructor {
	models: Record<string, Model>
	routes: Record<string, string>
	actions: Record<string, ActionHandler>
}

/**
 * A Spec instance holds all of the imported data of a spec, along with some local
 * state/optimizations/cache stuff, like a prepared sqlite3.Statement for every
 * route query.
 */
export class Spec {
	private models: Record<string, Model> = {}
	private routes: Record<string, sqlite3.Statement> = {}
	private actions: Record<string, ActionHandler> = {}
	private actionParameters: Record<string, string[]> = {}

	private hypercore: Feed
	private database: sqlite3.Database

	private db: Record<string, ContextModel> = {}

	constructor(
		readonly multihash: string,
		path: string,
		{ actions, models, routes }: SpecConstructor
	) {
		this.database = new Database(`${path}/db.sqlite`)

		for (const [name, handler] of Object.entries(actions)) {
			match(name, /^[a-zA-Z0-9]+$/, "action name must be alphanumeric")
			if (typeof handler !== "function") {
				throw new Error("action handler must be a function")
			}
			this.actions[name] = handler
			this.actionParameters[name] = Spec.parseHandlerParameters(handler)
		}

		for (const [name, route] of Object.entries(routes)) {
			// TODO: validate route query (???)
			this.routes[name] = this.database.prepare(route)
		}

		for (const [name, model] of Object.entries(models)) {
			match(name, /^[a-zA-Z0-9]+$/, "model name must be alphanumeric")
			this.models[name] = model
		}

		this.hypercore = hypercore(`${path}/hypercore`, {
			valueEncoding: "binary",
		})
	}

	// Initialization methods

	public initialize(): Promise<this> {
		this.initializeDB()
		return new Promise((resolve, reject) => {
			this.hypercore.on("ready", () => {
				console.log("hypercore.ready:", this.hypercore.length)
				resolve(this)
			})
		})
	}

	private initializeDB() {
		this.database.pragma("foreign_keys = ON", { simple: true })

		const selectTable = this.database.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
		)

		const tables: string[] = []
		for (const [modelName, model] of Object.entries(this.models)) {
			// TODO: check for exact schema matches in the case that the table exists
			const table = selectTable.get({ name: modelName })
			if (table === undefined) {
				const columns = ["_id TEXT PRIMARY KEY NOT NULL"]
				for (const [fieldName, fieldType] of Object.entries(model)) {
					match(fieldName, /^[a-zA-Z0-9]+$/, "field name must be alphanumeric")
					columns.push(`${fieldName} ${Spec.getColumnType(fieldType)}`)
				}

				tables.push(`CREATE TABLE ${modelName} (${columns.join(", ")});`)
			}
		}

		this.database.exec(tables.join("\n"))
		for (const [name, model] of Object.entries(this.models)) {
			const fields = Object.keys(model).map((field) => `:${field}`)
			const statement = this.database.prepare(
				`INSERT INTO ${name} VALUES (:_id, ${fields.join(", ")})`
			)

			this.db[name] = {
				create(args) {
					for (const [name, type] of Object.entries(model)) {
						// validate args
						const value = args[name]
						assert(value !== undefined, `missing value for argument ${name}`)
						Spec.validateType(type, value)
					}

					for (const name of Object.keys(args)) {
						assert(name in model, `extraneous argument ${name}`)
					}

					statement.run(args)
				},
			}
		}

		Object.freeze(this.db)
	}

	// Static utility methods

	private static validateType(type: ModelType, value: ModelValue) {
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

	private static getColumnType(field: ModelType): string {
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
	private static parseHandlerParameters(handler: ActionHandler): string[] {
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
