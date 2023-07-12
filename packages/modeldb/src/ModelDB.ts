import assert from "node:assert"

import Database, * as sqlite from "better-sqlite3"
import { CID } from "multiformats"

import type { Config, ModelsInit, ModelValue } from "./types.js"
import { initializeModel, initializeRelation } from "./intialize.js"
import { parseConfig } from "./config.js"
import { signalInvalidType } from "./utils.js"
import { ImmutableModelAPI, MutableModelAPI } from "./api.js"

export interface Options {
	resolve?: (versionA: string, versionB: string) => string
}

export class ModelDB {
	public readonly db: sqlite.Database
	public readonly config: Config

	private apis: Record<string, MutableModelAPI | ImmutableModelAPI> = {}

	constructor(
		public readonly path: string,
		public readonly models: ModelsInit,
		private readonly options: Options = {}
	) {
		this.config = parseConfig(models)
		this.db = new Database(path)

		for (const model of this.config.models) {
			initializeModel(model, (sql) => this.db.exec(sql))
		}

		for (const relation of this.config.relations) {
			initializeRelation(relation, (sql) => this.db.exec(sql))
		}

		for (const model of this.config.models) {
			if (model.kind === "immutable") {
				this.apis[model.name] = new ImmutableModelAPI(this.db, model)
			} else if (model.kind === "mutable") {
				this.apis[model.name] = new MutableModelAPI(this.db, model)
			} else {
				signalInvalidType(model.kind)
			}
		}
	}

	public close() {
		this.db.close()
	}

	public get(modelName: string, cid: CID): ModelValue | null {
		const api = this.apis[modelName]
		assert(api !== undefined, "model not found")
		if (api instanceof MutableModelAPI) {
			return null
		} else if (api instanceof ImmutableModelAPI) {
			return api.get(cid)
		} else {
			signalInvalidType(api)
		}
	}

	public getAll(modelName: string, query: { select: {}; where: {} }): ModelValue[] {
		throw new Error("not implemented")
	}

	// Mutable model methods

	public set(modelName: string, key: string, value: ModelValue, options: { version?: string; metadata?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof MutableModelAPI, "cannot call .set on an immutable model")
	}

	public delete(modelName: string, key: string, options: { version?: string; metadata?: string } = {}) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof MutableModelAPI, "cannot call .set on an immutable model")
	}

	// Immutable model methods

	public add(modelName: string, value: ModelValue): CID {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .add on a mutable model")
		return api.add(value)
	}

	public remove(modelName: string, cid: CID) {
		const api = this.apis[modelName]
		assert(api !== undefined, `model ${modelName} not found`)
		assert(api instanceof ImmutableModelAPI, "cannot call .remove on a mutable model")
		api.remove(cid)
	}
}
