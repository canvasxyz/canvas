// tests for modeldbs with immutable models
import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

testOnModelDB("create a modeldb with an immutable model and a valid entry", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = modelDBConstructor(models)

	// add a user
	const userId = await db.add("user", { name: "test" })

	// get the user
	t.deepEqual(await db.get("user", userId), { name: "test" })

	// delete the user
	db.remove("user", userId)

	// assert returned user is null
	t.deepEqual(await db.get("user", userId), null)
})

testOnModelDB("create a modeldb with an immutable model and an invalid entry", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = modelDBConstructor(models)

	// add a user
	const error = await t.throwsAsync(() => db.add("user", { something: "test" }))

	t.is(error!.message, `missing value for property user/name`)
})
