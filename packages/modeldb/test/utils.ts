import "fake-indexeddb/auto"
import os from "node:os"
import fs from "node:fs"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"

import test, { ExecutionContext } from "ava"

import { unstable_dev } from "wrangler"
import type { Unstable_DevWorker } from "wrangler"
import sqlite3InitModule, { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm"
import { nanoid } from "nanoid"

import type { AbstractModelDB, ModelDBInit, ModelSchema } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"
import { ModelDB as ModelDBPostgres } from "@canvas-js/modeldb-pg"
import { ModelDBProxy as ModelDBDurableObjectsProxy } from "@canvas-js/modeldb-durable-objects"
import { ModelDB as ModelDBSqliteWasm } from "@canvas-js/modeldb-sqlite-wasm"
import { ModelDB as ModelDBSqliteExpo } from "@canvas-js/modeldb-sqlite-expo"
import { Awaitable } from "@canvas-js/utils"

let worker: Unstable_DevWorker

test.before(async (t) => {
	worker = await unstable_dev("test/worker-durable-objects.ts", {
		experimental: { disableExperimentalWarning: true },
		logLevel: "error",
		inspect: false,
		inspectorPort: undefined,
	})
})

test.after.always((t) => worker.stop())

export function getConnectionConfig() {
	const { POSTGRES_HOST, POSTGRES_PORT } = process.env
	if (POSTGRES_HOST && POSTGRES_PORT) {
		return {
			user: "postgres",
			database: "test",
			password: "postgres",
			port: parseInt(POSTGRES_PORT),
			host: POSTGRES_HOST,
		}
	} else {
		return "postgresql://localhost:5432/test"
	}
}

export type PlatformConfig = {
	sqliteWasm?: boolean
	sqlite?: boolean
	idb?: boolean
	pg?: boolean
	do?: boolean
	expo?: boolean
}

export const testPlatforms = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (t: ExecutionContext, models: ModelSchema) => Promise<AbstractModelDB>,
	) => void,
	platforms: PlatformConfig = { sqliteWasm: true, sqlite: true, idb: true, pg: true, do: true, expo: true },
) => {
	const macro = test.macro(run)

	const connectionConfig = getConnectionConfig()

	if (platforms.sqlite) {
		test(`Sqlite - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBSqlite.open(null, { models })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.idb) {
		test(`IDB - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBIdb.open(nanoid(), { models })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.pg) {
		test.serial(`Postgres - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBPostgres.open(connectionConfig, { models, clear: true })
			t.teardown(() => mdb.close())
			return mdb
		})
	}

	if (platforms.do) {
		test.serial(`Durable Objects - ${name}`, macro, async (t, models) => {
			const mdb = new ModelDBDurableObjectsProxy(worker, models)
			await mdb.initialize()
			return mdb
		})
	}

	if (platforms.expo) {
		// test(`React Native - ${name}`, macro, async (t, models) => {
		// 	const mdb = new ModelDBSqliteExpo({ path: null, models })
		// 	t.teardown(() => mdb.close())
		// 	return mdb
		// })
	}

	if (platforms.sqliteWasm) {
		test.serial(`Sqlite Wasm - ${name}`, macro, async (t, models) => {
			const mdb = await ModelDBSqliteWasm.open(null, { models })
			t.teardown(() => mdb.close())
			return mdb
		})
	}
}

export const testPlatformsPersistent = (
	name: string,
	run: (
		t: ExecutionContext,
		openDB: (
			t: ExecutionContext,
			init: ModelDBInit,
			callback?: (modelDB: AbstractModelDB) => Awaitable<void>,
		) => Promise<void>,
	) => void,
) => {
	const macro = test.macro(run)

	{
		const paths = new WeakMap<ExecutionContext, string>()
		test.serial(`Sqlite - ${name}`, macro, async (t, init, callback) => {
			if (!paths.has(t)) {
				const path = resolve(getDirectory(t), "db.sqlite")
				paths.set(t, path)
			}

			const path = paths.get(t)!
			const modelDB = await ModelDBSqlite.open(path, init)
			await Promise.resolve(callback?.(modelDB)).finally(() => modelDB.close())
		})
	}

	{
		const names = new WeakMap<ExecutionContext, string>()
		test.serial(`IDB - ${name}`, macro, async (t, init, callback) => {
			if (!names.has(t)) {
				const name = randomUUID()
				names.set(t, name)
			}

			const name = names.get(t)!
			const modelDB = await ModelDBIdb.open(name, init)
			await Promise.resolve(callback?.(modelDB)).finally(() => modelDB.close())
		})
	}

	{
		const connectionConfig = getConnectionConfig()
		let clear = true
		test.serial(`Postgres - ${name}`, macro, async (t, init, callback) => {
			try {
				const modelDB = await ModelDBPostgres.open(connectionConfig, { ...init, clear })
				await Promise.resolve(callback?.(modelDB)).finally(() => modelDB.close())
			} finally {
				clear = false
			}
		})
	}

	// {
	// 	test.serial(`Durable Objects - ${name}`, macro, async (t, init) => {
	// 		const mdb = new ModelDBDurableObjectsProxy(worker, init)
	// 		await mdb.initialize()
	// 		return mdb
	// 	})
	// }

	{
		const dbs = new WeakMap<ExecutionContext, Database>()
		test.serial(`Sqlite WASM - ${name}`, macro, async (t, init, callback) => {
			const sqlite3 = await sqlite3InitModule()
			if (!dbs.has(t)) {
				const db = new sqlite3.oo1.DB(":memory:")
				t.teardown(() => db.close())
				dbs.set(t, db)
			}

			const db = dbs.get(t)!
			const modelDB = await ModelDBSqliteWasm.open(null, init, { db, sqlite3 })
			await Promise.resolve(callback?.(modelDB))
		})
	}
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

export function getDirectory(t: ExecutionContext<unknown>): string {
	const directory = resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	t.log("Created temporary directory", directory)
	t.teardown(() => {
		fs.rmSync(directory, { recursive: true })
		t.log("Removed temporary directory", directory)
	})
	return directory
}
