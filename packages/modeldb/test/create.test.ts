import type { ModelsInit } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

testOnModelDB("create modeldb with no models", async (t, openDB) => {
	await t.notThrowsAsync(async () => {
		const db = await openDB({})
		await db.close()
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
	} satisfies ModelsInit

	await t.notThrowsAsync(async () => {
		const db = await openDB(models)
		await db.close()
	})
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

testOnModelDB("create modeldb with a model with an optional json field should fail", async (t, openDB) => {
	// @ts-ignore
	const models = {
		room: {
			name: "json?",
		},
	} as ModelsInit

	await t.throwsAsync(() => openDB(models), { message: `field "name" is invalid - json fields cannot be optional` })
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
