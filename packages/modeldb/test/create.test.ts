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
