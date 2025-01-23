import type { ModelSchema } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

testOnModelDB("create modeldb with no models", async (t, openDB) => {
	await t.notThrowsAsync(async () => {
		await openDB(t, {})
	})
})

testOnModelDB("create modeldb with a model with valid fields", async (t, openDB) => {
	const models = {
		room: {
			id: "primary",
			name: "string",
			isModerator: "boolean",
			creator: "@user",
			members: "@user[]",
		},
		user: { id: "primary" },
	} satisfies ModelSchema

	await t.notThrowsAsync(async () => {
		await openDB(t, models)
	})
})

testOnModelDB("create modeldb with a model with invalid fields should fail", async (t, openDB) => {
	// @ts-ignore
	const models = {
		room: {
			name: "unsupported",
		},
	} as ModelSchema

	await t.throwsAsync(() => openDB(t, models), { message: `error defining room: invalid property "unsupported"` })
})

testOnModelDB("create a model without a primary key", async (t, openDB) => {
	const models = {
		room: {
			name: "string",
		},
	} satisfies ModelSchema

	await t.throwsAsync(() => openDB(t, models))
})

testOnModelDB("create a model with two primary keys", async (t, openDB) => {
	const models = {
		user: {
			id: "primary",
			address: "primary",
			name: "string?",
		},
	} satisfies ModelSchema

	await t.throwsAsync(() => openDB(t, models))
})

testOnModelDB("create a model with an integer primary key", async (t, openDB) => {
	const models = {
		user: { $primary: "id", id: "integer", name: "string?" },
	} satisfies ModelSchema

	await t.notThrowsAsync(() => openDB(t, models))
})

testOnModelDB("create a model with a composite primary key", async (t, openDB) => {
	const models = {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?" },
	} satisfies ModelSchema

	await t.notThrowsAsync(() => openDB(t, models))
})

testOnModelDB("create a model with a reference to a composite primary key", async (t, openDB) => {
	const models = {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?" },
		room: { $primary: "key/index", key: "string", index: "integer", name: "string?", creator: "@user" },
	} satisfies ModelSchema

	await t.notThrowsAsync(() => openDB(t, models))
})

testOnModelDB("create a model with a relation on a composite primary key", async (t, openDB) => {
	const models = {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?", members: "@room[]" },
		room: { $primary: "key/index", key: "string", index: "integer", name: "string?", creator: "@user" },
	} satisfies ModelSchema

	await t.notThrowsAsync(() => openDB(t, models))
})
