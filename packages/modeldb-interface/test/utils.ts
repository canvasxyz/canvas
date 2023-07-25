import "fake-indexeddb/auto"
import test from "ava"
import { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb-interface"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"
import { ModelDBOptions } from "packages/modeldb-sqlite/lib/ModelDB.js"

export const testOnModelDB = (
	name: string,
	testFn: <M extends AbstractModelDB>(
		t: any,
		modelDBConstructor: (models: ModelsInit, options?: ModelDBOptions) => M | Promise<M>
	) => void
) => {
	const macro = test.macro(testFn)

	test(`Sqlite - ${name}`, macro, (models, options) => new ModelDBSqlite(":memory:", models, options))
	test(`IDB - ${name}`, macro, (models, options) => ModelDBIdb.initialize(models, options))
}
