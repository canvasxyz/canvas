// tests for modeldbs with immutable models
import test from "ava"
import { ModelDB } from "../lib/index.js"
import { ModelsInit } from "@canvas-js/modeldb-interface"

test("create a modeldb with an immutable model and a valid entry", (t) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = new ModelDB(":memory:", models)

	// add a user
	const userId = db.add("user", { name: "test" })

	// get the user
	t.deepEqual(db.get("user", userId), { name: "test" })

	// delete the user
	db.remove("user", userId)

	// assert returned user is null
	t.deepEqual(db.get("user", userId), null)
})

test("create a modeldb with an immutable model and an invalid entry", (t) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "immutable",
		},
	} as ModelsInit
	const db = new ModelDB(":memory:", models)

	// add a user
	const error = t.throws(() => {
		db.add("user", { something: "test" })
	})

	t.is(error!.message, `missing value for property user/name`)
})
