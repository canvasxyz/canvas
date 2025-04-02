import "fake-indexeddb/auto"

import { AbstractModelDB, Config, Model } from "@canvas-js/modeldb"

import { testPlatformsPersistent } from "./utils.js"

testPlatformsPersistent("Initialize empty database", async (t, openDB) => {
	await openDB(t, { models: {} }, async (db) => {
		const models = await db.getAll<{ name: string; model: Model }>("$models")
		const versions = await db.query<{}>("$versions", {
			select: { namespace: true, version: true },
			orderBy: { "namespace/version": "asc" },
		})

		t.deepEqual(Object.fromEntries(models.map(({ name, model }) => [name, model])), Config.baseModels)

		t.deepEqual(versions, [{ namespace: AbstractModelDB.namespace, version: AbstractModelDB.version }])
	})
})

testPlatformsPersistent("Add models between versions", async (t, openDB) => {
	await openDB(
		t,
		{
			models: {
				users: { $primary: "id", id: "integer", address: "string" },
			},
		},
		async () => {},
	)

	await t.throwsAsync(() =>
		openDB(
			t,
			{
				models: {
					users: { $primary: "id", id: "integer", address: "string" },
					users2: { $primary: "id", id: "integer", address: "string" },
				},
			},
			async () => {},
		),
	)

	await openDB(
		t,
		{
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
		},
		async (db) => void t.deepEqual(db.version, { modeldb: 1, test: 9 }),
	)
})

testPlatformsPersistent("Add property", async (t, openDB) => {
	await openDB(
		t,
		{
			models: { users: { $primary: "id", id: "integer" } },
		},
		async () => {},
	)

	await openDB(
		t,
		{
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
					await api.addProperty("users", "address", "string?", null)
				}
			},
		},
		async (db) => {
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
		},
	)
})
