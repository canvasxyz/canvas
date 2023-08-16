import Database, * as sqlite from "better-sqlite3"

import {
	AbstractModelDB,
	Effect,
	ImmutableModelAPI,
	ModelsInit,
	MutableModelAPI,
	Resolve,
	parseConfig,
} from "@canvas-js/modeldb-interface"
import { initializeModel, initializeRelation } from "./initialize.js"
import { assert, signalInvalidType } from "./utils.js"
import { createSqliteImmutableModelAPI, createSqliteMutableModelAPI } from "./api.js"

export interface ModelDBOptions {
	resolve?: Resolve
	dkLen?: number
}

export class ModelDB extends AbstractModelDB {
	public readonly db: sqlite.Database

	readonly #transaction: sqlite.Transaction<
		(effects: Effect[], options: { namespace?: string; version?: string; metadata?: string }) => Promise<void>
	>

	constructor(public readonly path: string | null, public readonly models: ModelsInit, options: ModelDBOptions = {}) {
		super(parseConfig(models))

		this.db = new Database(path ?? ":memory:")

		for (const model of this.config.models) {
			initializeModel(model, (sql) => this.db.exec(sql))
		}

		for (const relation of this.config.relations) {
			initializeRelation(relation, (sql) => this.db.exec(sql))
		}

		for (const model of this.config.models) {
			if (model.kind === "immutable") {
				this.apis[model.name] = createSqliteImmutableModelAPI(this.db, model, options)
			} else if (model.kind === "mutable") {
				this.apis[model.name] = createSqliteMutableModelAPI(this.db, model, options)
			} else {
				signalInvalidType(model.kind)
			}
		}

		this.#transaction = this.db.transaction(async (effects, { version, namespace, metadata }) => {
			for (const effect of effects) {
				if (effect.operation === "add") {
					const api = this.apis[effect.model]
					assert(api !== undefined, `model ${effect.model} not found`)
					assert(api instanceof ImmutableModelAPI, "cannot call .add on a mutable model")
					await api.add(effect.value, { namespace, metadata })
				} else if (effect.operation === "remove") {
					const api = this.apis[effect.model]
					assert(api !== undefined, `model ${effect.model} not found`)
					assert(api instanceof ImmutableModelAPI, "cannot call .remove on a mutable model")
					await api.remove(effect.key)
				} else if (effect.operation === "set") {
					const api = this.apis[effect.model]
					assert(api !== undefined, `model ${effect.model} not found`)
					assert(api instanceof MutableModelAPI, "cannot call .set on an immutable model")
					await api.set(effect.key, effect.value, { version, metadata })
				} else if (effect.operation === "delete") {
					const api = this.apis[effect.model]
					assert(api !== undefined, `model ${effect.model} not found`)
					assert(api instanceof MutableModelAPI, "cannot call .delete on an immutable model")
					await api.delete(effect.key, { version, metadata })
				} else {
					signalInvalidType(effect)
				}
			}
		})
	}

	public async apply(
		effects: Effect[],
		options: { namespace?: string | undefined; version?: string | undefined; metadata?: string | undefined }
	): Promise<void> {
		await this.#transaction(effects, options)
	}

	public async close() {
		this.db.close()
	}
}
