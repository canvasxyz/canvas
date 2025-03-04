import "fake-indexeddb/auto"
import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import { unstable_dev } from "wrangler"
import type { Unstable_DevWorker } from "wrangler"

import type { AbstractModelDB, ModelSchema } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"
import { ModelDB as ModelDBPostgres } from "@canvas-js/modeldb-pg"
import { ModelDBProxy as ModelDBDurableObjectsProxy } from "@canvas-js/modeldb-durable-objects"
import { ModelDB as ModelDBSqliteWasm } from "@canvas-js/modeldb-sqlite-wasm"
import { ModelDB as ModelDBSqliteExpo } from "@canvas-js/modeldb-sqlite-expo"

let worker: Unstable_DevWorker

test.before(async (t) => {
	worker = await unstable_dev("test/worker-durable-objects.ts", {
		experimental: { disableExperimentalWarning: true },
		logLevel: "error",
	})
})

test.after(async (t) => {
	await worker.stop()
})

function getConnectionConfig() {
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
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	t.log("Created temporary directory", directory)
	t.teardown(() => {
		fs.rmSync(directory, { recursive: true })
		t.log("Removed temporary directory", directory)
	})
	return directory
}
