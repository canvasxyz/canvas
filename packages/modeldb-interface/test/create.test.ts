// tests for creating modeldbs
import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

testOnModelDB("create modeldb with no models", async (t, modelDBConstructor) => {
	await modelDBConstructor({})

	t.pass()
})

testOnModelDB("create modeldb with an empty model should fail", async (t, modelDBConstructor) => {
	const models: ModelsInit = {
		room: {},
	}
	const error = await t.throwsAsync(async () => {
		await modelDBConstructor(models)
	})

	t.is(error!.message, `Model "room" has no columns`)
})

testOnModelDB("create modeldb with a model with valid fields", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		room: {
			name: "string",
			creator: "@user",
			members: "@user[]",
			$type: "immutable",
		},
	} as ModelsInit
	await modelDBConstructor(models)

	t.pass()
})

testOnModelDB("create modeldb with a model with invalid fields should fail", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		room: {
			name: "unsupported",
		},
	} as ModelsInit
	const error = await t.throwsAsync(async () => {
		await modelDBConstructor(models)
	})

	t.is(error!.message, `invalid property`)
})
