import path from "node:path"

import { getQuickJS, QuickJSWASMModule } from "quickjs-emscripten"

import { RandomAccessStorage } from "random-access-storage"
import randomAccessFile from "random-access-file"
import Database, * as sqlite from "better-sqlite3"
import { Client as HyperspaceClient, Server as HyperspaceServer, CoreStore } from "hyperspace"

import { ModelValue } from "./models.js"
import { Core, assert } from "./core.js"

export class NativeCore extends Core {
	public readonly database: sqlite.Database
	private readonly modelStatements: Record<string, { set: sqlite.Statement }> = {}
	private readonly routeStatements: Record<string, sqlite.Statement> = {}

	static async initialize(
		multihash: string,
		spec: string,
		options: {
			directory: string
			port?: number
			storage?: (file: string) => RandomAccessStorage
			peers?: string[]
		}
	) {
		const storage =
			options.storage || ((file: string) => randomAccessFile(path.resolve(options.directory, "hypercore", file)))

		const hyperspacePort = 9000 + Math.round(Math.random() * 1000)
		const hyperspace = new HyperspaceServer({ storage, port: hyperspacePort })
		await hyperspace.ready()
		const quickJS = await getQuickJS()
		return new NativeCore(multihash, spec, { storage, ...options }, hyperspace, hyperspacePort, quickJS)
	}

	constructor(
		multihash: string,
		spec: string,
		options: {
			directory: string
			port?: number
			peers?: string[]
		},
		hyperspace: HyperspaceServer,
		hyperspacePort: number,
		quickJS: QuickJSWASMModule
	) {
		super(
			multihash,
			spec,
			{
				storage: (file: string) => randomAccessFile(path.resolve(options.directory, "hypercore", file)),
				peers: options.peers,
			},
			hyperspace,
			hyperspacePort,
			quickJS
		)

		this.database = new Database(path.resolve(options.directory, "db.sqlite"))

		// this has to be called *before* we try to prepare any statements
		this.database.exec(Core.getDatabaseSchema(this.models))

		// Prepare model statements
		for (const [name, model] of Object.entries(this.models)) {
			// TODO: validate model name
			const keys = ["timestamp", ...Object.keys(model)]
			const fields = keys.join(", ")
			const params = keys.map((key) => `:${key}`).join(", ")
			const condition = (n: string) => `${n} = CASE WHEN timestamp < :timestamp THEN :${n} ELSE ${n} END`
			const updates = keys.map(condition).join(", ")

			this.modelStatements[name] = {
				set: this.database.prepare(
					`INSERT INTO ${name} (id, ${fields}) VALUES (:id, ${params}) ON CONFLICT (id) DO UPDATE SET ${updates}`
				),
			}

			// Prepare route statements
			for (const [route, query] of Object.entries(this.routes)) {
				this.routeStatements[route] = this.database.prepare(query)
			}
		}
	}

	public setModel(name: string, params: Record<string, ModelValue>) {
		assert(name in this.models, "invalid model name")
		const typedParams: Record<string, Exclude<ModelValue, boolean>> = {}
		for (const [key, value] of Object.entries(params)) {
			typedParams[key] = typeof value === "boolean" ? Number(value) : value
		}
		this.modelStatements[name].set.run(typedParams)
	}

	public async getRoute(route: string, params: Record<string, ModelValue> = {}): Promise<Record<string, ModelValue>[]> {
		assert(route in this.routes, "invalid route")
		const statement = this.routeStatements[route]
		const typedParams: Record<string, Exclude<ModelValue, boolean>> = {}
		for (const [key, value] of Object.entries(params)) {
			typedParams[key] = typeof value === "boolean" ? Number(value) : value
		}

		return statement.all(typedParams)
	}

	public async close() {
		await super.close()
		this.database.close()
	}
}
