import "fake-indexeddb/auto"
import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"
import { ModelDB as ModelDBPostgres } from "@canvas-js/modeldb-pg"

export const testOnModelDB = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (t: ExecutionContext, models: ModelSchema) => Promise<AbstractModelDB>,
	) => void,
) => {
	const macro = test.macro(run)

	const connectionConfig =
		process.env.POSTGRES_HOST && process.env.POSTGRES_PORT
			? {
					user: "postgres",
					database: "test",
					password: "postgres",
					port: parseInt(process.env.POSTGRES_PORT, 10),
					host: process.env.POSTGRES_HOST,
				}
			: `postgresql://localhost:5432/test`

	test(`Sqlite - ${name}`, macro, async (t, models) => {
		const mdb = new ModelDBSqlite({ path: null, models })
		t.teardown(() => mdb.close())
		return mdb
	})
	test(`IDB - ${name}`, macro, async (t, models) => {
		const mdb = await ModelDBIdb.initialize({ name: nanoid(), models })
		t.teardown(() => mdb.close())
		return mdb
	})
	test.serial(`Postgres - ${name}`, macro, async (t, models) => {
		const mdb = await ModelDBPostgres.initialize({ connectionConfig, models, clear: true })
		t.teardown(() => mdb.close())
		return mdb
	})
}

export const compareUnordered = (t: ExecutionContext, a: any[], b: any[]) => {
	t.is(a.length, b.length)

	const serializedA = a.map((x) => JSON.stringify(x)).sort()
	const serializedB = b.map((x) => JSON.stringify(x)).sort()
	t.deepEqual(serializedA, serializedB)
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}
	return values
}
