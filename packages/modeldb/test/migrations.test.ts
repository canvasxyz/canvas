import { resolve } from "node:path"
import test from "ava"

import { AbstractModelDB, Config, Model } from "@canvas-js/modeldb"
import { ModelDB } from "@canvas-js/modeldb-sqlite"

import { getDirectory } from "./utils.js"

test("Initialize empty database", async (t) => {
	const db = await ModelDB.open({ path: null, models: {} })

	const models = db.getAll<{ name: string; model: Model }>("$models")
	const versions = db.query<{}>("$versions", {
		select: { namespace: true, version: true },
		orderBy: { "namespace/version": "asc" },
	})

	t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), Config.baseModels)

	t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])
})

test("Initialize example database", async (t) => {
	const db = await ModelDB.open({
		path: null,
		models: {
			users: { $primary: "id", id: "integer", address: "string" },
		},
	})

	const models = db.getAll<{ name: string; model: Model }>("$models")
	const versions = db.query<{}>("$versions", {
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

test("Add models between versions", async (t) => {
	const path = resolve(getDirectory(t), "db.sqlite")

	{
		const db = await ModelDB.open({
			path: path,
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
			},
		})

		await db.close()
	}

	await t.throwsAsync(() =>
		ModelDB.open({
			path: path,
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
				users2: { $primary: "id", id: "integer", address: "string" },
			},
		}).then((db) => db.close()),
	)

	await t.notThrowsAsync(
		ModelDB.open({
			path: path,
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
				users2: { $primary: "id", id: "integer", address: "string" },
			},

			version: { test: 9 },
			upgrade: async (api, oldVersion, newVersion) => {
				// t.deepEqual(oldVersion, { modeldb: AbstractModelDB.version })
				// t.deepEqual(newVersion, { modeldb: AbstractModelDB.version, test: 9 })

				if (oldVersion.test ?? 0 < 9) {
					api.createModel("users2", { $primary: "id", id: "integer", address: "string" })
				}
			},
		}).then((db) => db.close()),
	)

	// await t.throwsAsync(
	// 	ModelDB.open({
	// 		path: path,
	// 		version: { test: 7 },
	// 		models: {
	// 			users: { $primary: "id", id: "integer", address: "string" },
	// 			users2: { $primary: "id", id: "integer", address: "string" },
	// 		},
	// 	}).then((db) => db.close()),
	// )

	// await t.throwsAsync(
	// 	ModelDB.open({
	// 		path: path,
	// 		version: { test: 9 },
	// 		models: {
	// 			users: { $primary: "id", id: "integer", address: "string" },
	// 			users2: { $primary: "id", id: "integer", address: "string" },
	// 			users3: { $primary: "id", id: "integer", address: "string" },
	// 		},
	// 	}).then((db) => db.close()),
	// )

	// await t.notThrowsAsync(
	// 	ModelDB.open({
	// 		path: path,
	// 		version: { test: 10 },
	// 		upgrade: async (api, oldVersion, newVersion) => {
	// 			t.deepEqual(oldVersion, { modeldb: AbstractModelDB.version, test: 9 })
	// 			t.deepEqual(newVersion, { modeldb: AbstractModelDB.version, test: 10 })
	// 			await api.createModel("users3", { $primary: "id", id: "integer", address: "string" })
	// 		},
	// 		models: {
	// 			users: { $primary: "id", id: "integer", address: "string" },
	// 			users2: { $primary: "id", id: "integer", address: "string" },
	// 			users3: { $primary: "id", id: "integer", address: "string" },
	// 		},
	// 	}).then((db) => db.close()),
	// )
})
