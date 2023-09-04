// tests for creating modeldbs
import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

testOnModelDB("create modeldb with no models", async (t, openDB) => {
	await t.notThrowsAsync(() => openDB({}))
})

testOnModelDB("create modeldb with an empty model", async (t, openDB) => {
	await t.notThrowsAsync(() => openDB({ room: {} }))
})

testOnModelDB("create modeldb with a model with valid fields", async (t, openDB) => {
	const models: ModelsInit = {
		room: {
			name: "string",
			creator: "@user",
			members: "@user[]",
		},
	}

	await t.notThrowsAsync(() => openDB(models))
})

testOnModelDB("create modeldb with a model with invalid fields should fail", async (t, openDB) => {
	// @ts-ignore
	const models = {
		room: {
			name: "unsupported",
		},
	} as ModelsInit

	const error = await t.throwsAsync(() => openDB(models))
	t.is(error?.message, `invalid property "unsupported"`)
})
