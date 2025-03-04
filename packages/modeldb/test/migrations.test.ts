import "fake-indexeddb/auto"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"

import test from "ava"

import { AbstractModelDB, Config, Model } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"

import { getDirectory } from "./utils.js"

test("Initialize empty database (SQLite)", async (t) => {
	const db = await ModelDBSqlite.open(null, { models: {} })

	const models = await db.getAll<{ name: string; model: Model }>("$models")
	const versions = await db.query<{}>("$versions", {
		select: { namespace: true, version: true },
		orderBy: { "namespace/version": "asc" },
	})

	t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), Config.baseModels)

	t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])
})

test("Initialize empty database (IDB)", async (t) => {
	const name = randomUUID()
	const db = await ModelDBIdb.open(name, { models: {} })

	const models = await db.getAll<{ name: string; model: Model }>("$models")
	const versions = await db.query<{}>("$versions", {
		select: { namespace: true, version: true },
		orderBy: { "namespace/version": "asc" },
	})

	t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), Config.baseModels)

	t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])
})

test("Initialize example database", async (t) => {
	const db = await ModelDBSqlite.open(null, {
		models: {
			users: { $primary: "id", id: "integer", address: "string" },
		},
	})

	const models = await db.getAll<{ name: string; model: Model }>("$models")
	const versions = await db.query<{}>("$versions", {
		select: { namespace: true, version: true },
		orderBy: { "namespace/version": "asc" },
	})

	t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), {
		...Config.baseModels,
		users: {
			name: "users",
			primaryKey: ["id"],
			properties: [
				{ name: "id", kind: "primitive", type: "integer", nullable: false },
				{ name: "address", kind: "primitive", type: "string", nullable: false },
			],
			indexes: [],
		},
	})

	t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])
})

// test("Add models between versions", async (t) => {
// 	const path = resolve(getDirectory(t), "db.sqlite")

// 	{
// 		const db = await ModelDBSqlite.open({
// 			path: path,
// 			models: {
// 				users: { $primary: "id", id: "integer", address: "string" },
// 			},
// 		})

// 		await db.close()
// 	}

// 	await t.throwsAsync(() =>
// 		ModelDBSqlite.open({
// 			path: path,
// 			models: {
// 				users: { $primary: "id", id: "integer", address: "string" },
// 				users2: { $primary: "id", id: "integer", address: "string" },
// 			},
// 		}).then((db) => db.close()),
// 	)

// 	await t.notThrowsAsync(
// 		ModelDBSqlite.open({
// 			path: path,
// 			models: {
// 				users: { $primary: "id", id: "integer", address: "string" },
// 				users2: { $primary: "id", id: "integer", address: "string" },
// 			},

// 			version: { test: 9 },
// 			upgrade: async (api, oldVersion, newVersion) => {
// 				// t.deepEqual(oldVersion, { modeldb: AbstractModelDB.version })
// 				// t.deepEqual(newVersion, { modeldb: AbstractModelDB.version, test: 9 })

// 				if (oldVersion.test ?? 0 < 9) {
// 					api.createModel("users2", { $primary: "id", id: "integer", address: "string" })
// 				}
// 			},
// 		}).then((db) => db.close()),
// 	)
// })
