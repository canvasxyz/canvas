import type { ModelsInit } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

testOnModelDB("create modeldb with no models", async (t, openDB) => {
	await t.notThrowsAsync(() => openDB({}))
})

testOnModelDB("create modeldb with a model with valid fields", async (t, openDB) => {
	const models = {
		room: {
			id: "primary",
			name: "string",
			creator: "@user",
			members: "@user[]",
		},
	} satisfies ModelsInit

	await openDB(models)
	t.pass()
	// await t.notThrowsAsync(() => openDB(models))
})

testOnModelDB("create modeldb with a model with invalid fields should fail", async (t, openDB) => {
	// @ts-ignore
	const models = {
		room: {
			name: "unsupported",
		},
	} as ModelsInit

	await t.throwsAsync(() => openDB(models), { message: `invalid property "unsupported"` })
})

testOnModelDB("create a model without a primary key", async (t, openDB) => {
	const models = {
		room: {
			name: "string",
		},
	} satisfies ModelsInit

	await t.throwsAsync(() => openDB(models))
})

testOnModelDB("create a model with two primary keys", async (t, openDB) => {
	const models = {
		user: {
			id: "primary",
			address: "primary",
			name: "string?",
		},
	} satisfies ModelsInit

	await t.throwsAsync(() => openDB(models))
})
