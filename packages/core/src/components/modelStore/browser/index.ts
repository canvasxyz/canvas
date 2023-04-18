import type { ModelValue, Query } from "@canvas-js/interfaces"

import type { VM } from "@canvas-js/core/components/vm"
import { mapEntries, signalInvalidType } from "@canvas-js/core/utils"

import getSQL, { oo1 } from "#sqlite3"

import { initializeModelTables, getModelStatements, ModelStatements } from "../schema.js"
import type { Effect, ModelStore } from "../types.js"
export * from "../types.js"

const SQL = await getSQL()

class MemoryModelStore implements ModelStore {
	private readonly db = new SQL.oo1.DB()
	private readonly modelStatements: Record<string, Record<ModelStatements, oo1.Statement>> = {}

	constructor(directory: string | null, readonly vm: VM, readonly options: { verbose?: boolean }) {
		const models = vm.getModels()
		initializeModelTables(models, (sql) => this.db.exec(sql))
		for (const [name, model] of Object.entries(models)) {
			this.modelStatements[name] = mapEntries(getModelStatements(name, model), (_, sql) => this.db.prepare(sql))
		}
	}

	public async *exportModel(modelName: string, options: { offset?: number; limit?: number } = {}) {
		const s = this.modelStatements[modelName].export
		s.reset()
		s.bind({ ":limit": options.limit ?? -1 })
		s.bind({ ":offset": options.offset ?? 0 })
		while (s.step()) {
			yield s.get({}) as Record<string, ModelValue>
		}
	}

	async close() {
		this.db.close()
	}

	private getUpdatedAt(name: string, id: string): number | undefined {
		const { getUpdatedAt } = this.modelStatements[name]
		getUpdatedAt.reset()
		getUpdatedAt.bind([id])
		if (getUpdatedAt.step()) {
			const { updated_at } = getUpdatedAt.get<{ updated_at: number }>({})
			return updated_at
		} else {
			return undefined
		}
	}

	private getDeletedAt(name: string, id: string): number | undefined {
		const { getDeletedAt } = this.modelStatements[name]
		getDeletedAt.reset()
		getDeletedAt.bind([id])
		if (getDeletedAt.step()) {
			const { deleted_at } = getDeletedAt.get<{ deleted_at: number }>({})
			return deleted_at
		} else {
			return undefined
		}
	}

	async applyEffects(context: { timestamp: number }, effects: Effect[]): Promise<void> {
		this.db.transaction(() => {
			for (const effect of effects) {
				this.applyEffect(context, effect)
			}
		})
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
			const params: Record<string, oo1.Value> = { ":id": effect.id, ":updated_at": context.timestamp }
			for (const [property, value] of Object.entries(effect.values)) {
				params[`:${property}`] = typeof value === "boolean" ? Number(value) : value
			}

			if (updatedAt === undefined) {
				statements.insert.bind(params)
				statements.insert.stepReset()
			} else {
				statements.update.bind(params)
				statements.update.stepReset()
			}
		} else if (effect.type === "del") {
			if (deletedAt === undefined) {
				statements.insertDeleted.bind({ ":id": effect.id, ":deleted_at": context.timestamp })
				statements.insertDeleted.stepReset()
			} else {
				statements.updateDeleted.bind({ ":id": effect.id, ":deleted_at": context.timestamp })
				statements.updateDeleted.stepReset()
			}

			if (updatedAt !== undefined) {
				statements.delete.bind({ ":id": effect.id })
				statements.delete.stepReset()
			}
		} else {
			signalInvalidType(effect)
		}
	}

	private getParameterName(statement: oo1.Statement, name: string): string {
		const names = ["$" + name, ":" + name, "@" + name]
		const parameterName = names.find((parameterName) => !!statement.getParamIndex(parameterName))
		if (parameterName === undefined) {
			throw new Error(`statement has no parameter named ${JSON.stringify(name)}`)
		} else {
			return parameterName
		}
	}

	async getRoute(route: string, params: Record<string, string> = {}): Promise<Record<string, ModelValue>[]> {
		const filteredParams = mapEntries(params, (_, value) => (typeof value === "boolean" ? Number(value) : value))
		return this.vm.executeRoute(route, filteredParams, (query: string | Query) => {
			const statement = this.db.prepare(typeof query === "string" ? query : query.query)
			if (typeof query !== "string" && query.args !== undefined) {
				if (Array.isArray(query.args)) {
					statement.bind(query.args)
				} else {
					const params: Record<string, oo1.Value> = {}
					for (const [name, value] of Object.entries(query.args)) {
						const parameterName = this.getParameterName(statement, name)
						params[parameterName] = value
					}

					statement.bind(params)
				}
			}

			const results: Record<string, ModelValue>[] = []
			while (statement.step()) {
				results.push(statement.get({}) as Record<string, ModelValue>)
			}

			return results
		})
	}
}

export const openModelStore = async (
	directory: string | null,
	vm: VM,
	options: { verbose?: boolean } = {}
): Promise<ModelStore> => new MemoryModelStore(directory, vm, options)
