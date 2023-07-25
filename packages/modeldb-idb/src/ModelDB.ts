import { AbstractModelDB, Config, ModelsInit, parseConfig } from "@canvas-js/modeldb-interface"
import { IDBPDatabase, openDB } from "idb"
import { signalInvalidType } from "./utils.js"
import { createIdbImmutableModelAPI, createIdbMutableModelAPI } from "./api.js"

export interface ModelDBOptions {
	dkLen?: number
	resolve?: (versionA: string, versionB: string) => string
}

export class ModelDB extends AbstractModelDB {
	public static async initialize(models: ModelsInit, options?: ModelDBOptions) {
		const config = parseConfig(models)

		const db = await openDB("modeldb", 1, {
			upgrade(db: any) {
				// create model stores
				for (const model of config.models) {
					db.createObjectStore(model.name)
				}

				// create relation stores

				// create tombstone stores for mutable models?
			},
		})

		return new ModelDB(db, config, options)
	}

	constructor(public readonly db: IDBPDatabase, config: Config, options?: ModelDBOptions) {
		super()

		for (const model of config.models) {
			if (model.kind === "immutable") {
				this.apis[model.name] = createIdbImmutableModelAPI(this.db, model, options)
			} else if (model.kind === "mutable") {
				this.apis[model.name] = createIdbMutableModelAPI(this.db, model, options)
			} else {
				signalInvalidType(model.kind)
			}
		}
	}

	close() {
		this.db.close()
	}
}
