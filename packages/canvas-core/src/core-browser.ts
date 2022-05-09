/// <reference types="../types/random-access-storage" />
/// <reference types="../types/random-access-memory" />
/// <reference types="../types/random-access-idb" />
/// <reference types="../types/ipfs-only-hash" />

import { getQuickJS, QuickJSWASMModule } from "quickjs-emscripten"

import type { RandomAccessStorage } from "random-access-storage"
import randomAccessMemory from "random-access-memory"
import initSqlJs, { SqlJsStatic, Statement, Database, SqlJsConfig } from "sql.js"

import Hash from "ipfs-only-hash"

import { ObjectSpec, objectSpecType, stringSpecType } from "./specs.js"
import type { ModelValue } from "./models.js"
import { Core } from "./core.js"
import { assert, objectSpecToString } from "./utils.js"

export class BrowserCore extends Core {
	private readonly database: Database
	private readonly modelStatements: Record<string, { set: Statement }> = {}
	private readonly routeStatements: Record<string, Statement> = {}

	static async initialize(config: {
		spec: string | ObjectSpec
		storage?: (file: string) => RandomAccessStorage
		sqlJsOptions?: SqlJsConfig
		replay?: boolean
	}) {
		assert(objectSpecType.is(config.spec) || stringSpecType.is(config.spec), "invalid spec")

		const quickJS = await getQuickJS()
		const SQL = await initSqlJs(config.sqlJsOptions)
		const spec = typeof config.spec === "string" ? config.spec : objectSpecToString(config.spec)
		const multihash = await Hash.of(spec)
		const storage = config.storage || randomAccessMemory
		const core = new BrowserCore({ multihash, spec, quickJS, SQL, storage })
		if (config.replay) await core.replay()
		return core
	}

	constructor(config: {
		multihash: string
		spec: string
		storage: (file: string) => RandomAccessStorage
		quickJS: QuickJSWASMModule
		SQL: SqlJsStatic
	}) {
		super({ ...config })

		this.database = new config.SQL.Database()

		// this has to be called *before* we try to prepare any statements
		this.database.exec(Core.getDatabaseSchema(this.models))

		// Prepare model statements
		for (const [name, model] of Object.entries(this.models)) {
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
		}

		// Prepare route statements
		for (const [route, query] of Object.entries(this.routes)) {
			this.routeStatements[route] = this.database.prepare(query)
		}
	}

	public setModel(name: string, params: Record<string, ModelValue>) {
		assert(name in this.models, "invalid model name")
		const typedParams: Record<string, Exclude<ModelValue, boolean>> = {}
		for (const [key, value] of Object.entries(params)) {
			typedParams[`:${key}`] = typeof value === "boolean" ? Number(value) : value
		}
		this.modelStatements[name].set.run(typedParams)
	}

	public getRoute(route: string, params: Record<string, ModelValue> = {}): Record<string, ModelValue>[] {
		assert(route in this.routes, "invalid route")
		const statement = this.routeStatements[route]
		statement.bind(
			Object.fromEntries(
				Object.entries(params).map(([key, value]) => [`:${key}`, typeof value === "boolean" ? Number(value) : value])
			)
		)

		const results: Record<string, ModelValue>[] = []
		while (statement.step()) {
			// @ts-ignore
			results.push(statement.getAsObject())
		}

		return results
	}

	public async close() {
		await super.close()
		this.database.close()
	}
}
