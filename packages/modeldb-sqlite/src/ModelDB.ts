import Database, * as sqlite from "better-sqlite3"

import { AbstractModelDB, ModelsInit, parseConfig } from "@canvas-js/modeldb-interface"
import { initializeModel, initializeRelation } from "./initialize.js"
import { signalInvalidType } from "./utils.js"
import { createSqliteImmutableModelAPI, createSqliteMutableModelAPI } from "./api.js"

export interface ModelDBOptions {
	dkLen?: number
	resolve?: (versionA: string, versionB: string) => string
}

export class ModelDB extends AbstractModelDB {
	public readonly db: sqlite.Database

	constructor(public readonly path: string, public readonly models: ModelsInit, options: ModelDBOptions = {}) {
		super(parseConfig(models))

		this.db = new Database(path)

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
	}

	public async close() {
		this.db.close()
	}
}
