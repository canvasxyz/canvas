import "fake-indexeddb/auto"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"

import test, { ExecutionContext } from "ava"

import { AbstractModelDB, Config, Model, ModelDBInit, ModelInit, ModelSchema } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBPostgres } from "@canvas-js/modeldb-pg"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"

import { getConnectionConfig, getDirectory } from "./utils.js"

const testPlatforms = (
	name: string,
	run: (t: ExecutionContext, openDB: (t: ExecutionContext, init: ModelDBInit) => Promise<AbstractModelDB>) => void,
) => {
	const macro = test.macro(run)

	const paths = new WeakMap<ExecutionContext, string>()
	test.serial(`Sqlite - ${name}`, macro, async (t, init) => {
		if (!paths.has(t)) {
			const path = resolve(getDirectory(t), "db.sqlite")
			paths.set(t, path)
		}

		return await ModelDBSqlite.open(paths.get(t)!, init)
	})

	const names = new WeakMap<ExecutionContext, string>()
	test.serial(`IDB - ${name}`, macro, async (t, init) => {
		if (!names.has(t)) {
			const name = randomUUID()
			names.set(t, name)
		}

		return await ModelDBIdb.open(names.get(t)!, init)
	})

	const connectionConfig = getConnectionConfig()
	let clear = true
	test.serial(`Postgres - ${name}`, macro, async (t, init) => {
		try {
			return await ModelDBPostgres.open(connectionConfig, { ...init, clear })
		} finally {
			clear = false
		}
	})
}

testPlatforms("Initialize empty database", async (t, openDB) => {
	const db = await openDB(t, { models: {} })

	const models = await db.getAll<{ name: string; model: Model }>("$models")
	const versions = await db.query<{}>("$versions", {
		select: { namespace: true, version: true },
		orderBy: { "namespace/version": "asc" },
	})

	t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), Config.baseModels)

	t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])

	await db.close()
})

testPlatforms("Add models between versions", async (t, openDB) => {
	{
		const db = await openDB(t, {
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
			},
		})

		await db.close()
	}

	await t.throwsAsync(() =>
		openDB(t, {
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
				users2: { $primary: "id", id: "integer", address: "string" },
			},
		}).then((db) => db.close()),
	)

	{
		const db = await openDB(t, {
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
				users2: { $primary: "id", id: "integer", address: "string" },
			},

			version: { test: 9 },
			upgrade: async (api, oldConfig, oldVersion, newVersion) => {
				t.deepEqual(oldVersion, { modeldb: AbstractModelDB.version })
				t.deepEqual(newVersion, { modeldb: AbstractModelDB.version, test: 9 })

				if (oldVersion.test ?? 0 < 9) {
					await api.createModel("users2", { $primary: "id", id: "integer", address: "string" })
				}
			},
		})

		t.deepEqual(db.version, { modeldb: 1, test: 9 })

		await db.close()
	}
})

testPlatforms("Add property", async (t, openDB) => {
	{
		const db = await openDB(t, {
			models: {
				users: { $primary: "id", id: "integer" },
			},
		})

		await db.close()
	}

	{
		const db = await openDB(t, {
			models: {
				users: {
					$primary: "id",
					id: "integer",
					address: "string?",
				},
			},

			version: { test: 9 },
			upgrade: async (api, oldConfig, oldVersion, newVersion) => {
				t.deepEqual(oldVersion, { modeldb: AbstractModelDB.version })
				t.deepEqual(newVersion, { modeldb: AbstractModelDB.version, test: 9 })

				if (oldVersion.test ?? 0 < 9) {
					await api.addProperty("users", "address", "string?")
				}
			},
		})

		t.deepEqual(db.version, { modeldb: 1, test: 9 })
		t.deepEqual(db.config.models, [
			...Object.values(Config.baseModels),
			{
				name: "users",
				primaryKey: ["id"],
				properties: [
					{ name: "id", kind: "primitive", type: "integer", nullable: false },
					{ name: "address", kind: "primitive", type: "string", nullable: true },
				],
				indexes: [],
			},
		])

		await db.close()
	}
})
