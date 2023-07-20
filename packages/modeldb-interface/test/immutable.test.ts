// tests for modeldbs with immutable models
import test from "ava"
import { ModelDB } from "@canvas-js/modeldb-sqlite"
import { ModelsInit } from "@canvas-js/modeldb-interface"

test("create a modeldb with an immutable model and a valid entry", async (t) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = new ModelDB(":memory:", models)

	// add a user
	const userId = await db.add("user", { name: "test" })

	// get the user
	t.deepEqual(await db.get("user", userId), { name: "test" })

	// delete the user
	db.remove("user", userId)

	// assert returned user is null
	t.deepEqual(await db.get("user", userId), null)
})

test("create a modeldb with an immutable model and an invalid entry", async (t) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = new ModelDB(":memory:", models)

	// add a user
	const error = await t.throwsAsync(() => db.add("user", { something: "test" }))

	t.is(error!.message, `missing value for property user/name`)
})
