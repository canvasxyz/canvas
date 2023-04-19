import path from "node:path"
import Database, * as sqlite from "better-sqlite3"
import chalk from "chalk"

import type { ModelValue, Query } from "@canvas-js/interfaces"

import type { VM } from "@canvas-js/core/components/vm"
import { mapEntries, signalInvalidType, assert } from "@canvas-js/core/utils"
import { MODEL_DATABASE_FILENAME } from "@canvas-js/core/constants"

import { getModelStatements, initializeModelTables, ModelStatements } from "../schema.js"
import type { Effect, ModelStore } from "../types.js"
export * from "../types.js"

class SqliteModelStore implements ModelStore {
	public readonly database: sqlite.Database

	private readonly transaction: (context: { timestamp: number }, effects: Effect[]) => void
	private readonly modelStatements: Record<string, Record<ModelStatements, sqlite.Statement>> = {}

	constructor(directory: string | null, private readonly vm: VM, options: { verbose?: boolean } = {}) {
		if (directory === null) {
			if (options.verbose) {
				console.log("[canvas-core] Initializing new in-memory database")
				console.warn(chalk.yellow("[canvas-core] All data will be lost on close!"))
			}

			this.database = new Database(":memory:")
		} else {
			const databasePath = path.resolve(directory, MODEL_DATABASE_FILENAME)

			if (options.verbose) {
				console.log(`[canvas-core] Initializing model store at ${databasePath}`)
			}

			this.database = new Database(databasePath)
		}

		const models = vm.getModels()
		initializeModelTables(models, (sql) => this.database.exec(sql))
		for (const [name, model] of Object.entries(models)) {
			this.modelStatements[name] = mapEntries(getModelStatements(name, model), (_, sql) => this.database.prepare(sql))
		}

		this.transaction = this.database.transaction((context: { timestamp: number }, effects: Effect[]): void => {
			for (const effect of effects) {
				this.applyEffect(context, effect)
			}
		})
	}

	public async *exportModel(
		modelName: string,
		options: { offset?: number; limit?: number } = {}
	): AsyncIterable<Record<string, ModelValue>> {
		const offset = Number.isSafeInteger(options.offset) ? options.offset : 0
		const limit = Number.isSafeInteger(options.limit) ? options.limit : -1
		for (const row of this.modelStatements[modelName].export.all({ offset, limit })) {
			yield row as Record<string, ModelValue>
		}
	}

	public async count(modelName: string): Promise<number> {
		const res = await this.modelStatements[modelName].count.all()
		return res[0] as number
	}

	private getUpdatedAt(name: string, id: string): number | undefined {
		const { getUpdatedAt } = this.modelStatements[name]
		const result = getUpdatedAt.get(id) as { updated_at: number } | undefined
		return result && result.updated_at
	}

	private getDeletedAt(name: string, id: string): number | undefined {
		const { getDeletedAt } = this.modelStatements[name]
		const result = getDeletedAt.get(id) as { deleted_at: number } | undefined
		return result && result.deleted_at
	}

	public async applyEffects(context: { timestamp: number }, effects: Effect[]) {
		this.transaction(context, effects)
	}

	private applyEffect(context: { timestamp: number }, effect: Effect) {
		const updatedAt = this.getUpdatedAt(effect.model, effect.id)
		if (updatedAt !== undefined && updatedAt > context.timestamp) {
			return
		}

		const deletedAt = this.getDeletedAt(effect.model, effect.id)
		if (deletedAt !== undefined && deletedAt > context.timestamp) {
			return
		}

		const statements = this.modelStatements[effect.model]
		if (effect.type === "set") {
			// sqlite doesn't actually support booleans, just integers,
			// and better-sqlite doesn't convert them automatically
			const params: Record<string, ModelValue> = { id: effect.id, updated_at: context.timestamp }
			for (const [property, value] of Object.entries(effect.values)) {
				params[property] = typeof value === "boolean" ? Number(value) : value
			}

			if (updatedAt === undefined) {
				statements.insert.run(params)
			} else {
				statements.update.run(params)
			}
		} else if (effect.type === "del") {
			if (deletedAt === undefined) {
				statements.insertDeleted.run({ id: effect.id, deleted_at: context.timestamp })
			} else {
				statements.updateDeleted.run({ id: effect.id, deleted_at: context.timestamp })
			}

			if (updatedAt !== undefined) {
				statements.delete.run({ id: effect.id })
			}
		} else {
			signalInvalidType(effect)
		}
	}

	public async close() {
		this.database.close()
	}

	public async getRoute(route: string, params: Record<string, string> = {}): Promise<Record<string, ModelValue>[]> {
		const filteredParams = mapEntries(params, (_, value) => (typeof value === "boolean" ? Number(value) : value))
		return this.vm.executeRoute(route, filteredParams, (query: string | Query) => {
			// TODO: Cache the prepared sql
			const prepared = typeof query === "string" ? this.database.prepare(query) : this.database.prepare(query.query)
			// Uses sqlite3_stmt_readonly() to make sure routes only SELECT data.
			// Note that custom functions could still mutate the database.
			assert(prepared.readonly === true, "invalid route, queries must be readonly")
			assert(prepared.reader === true, "invalid route, queries must return data")
			try {
				if (typeof query === "string" || query.args === undefined) {
					return prepared.all() as Record<string, ModelValue>[]
				} else {
					return prepared.all(query.args) as Record<string, ModelValue>[]
				}
			} catch (err) {
				if (err instanceof Error) {
					// Show a little more debugging information for queries
					const params = typeof query === "string" ? "none" : JSON.stringify(query.args)
					const formatted = (typeof query === "string" ? query : query.query).replace(/\n/g, " ")
					err.message = `${err.message} (query: ${formatted}, parameters: ${params})`
				}

				throw err
			}
		})
	}
}

export const openModelStore = async (
	directory: string | null,
	vm: VM,
	options: { verbose?: boolean } = {}
): Promise<ModelStore> => new SqliteModelStore(directory, vm, options)
