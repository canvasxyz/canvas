// tests for creating modeldbs
import test from "ava"
import { ModelDB, ModelsInit } from "@canvas-js/modeldb"

test("create modeldb with no models", (t) => {
	new ModelDB(":memory:", {}, { dkLen: 16 })

	t.pass()
})

test("create modeldb with an empty model should fail", (t) => {
	const models: ModelsInit = {
		room: {},
	}
	// this throws a sql error, what should it do? more useful error message?
	const error = t.throws(() => {
		new ModelDB(":memory:", models)
	})

	t.is(error!.message, `Model "room" has no columns`)
})

test("create modeldb with a model with valid fields", (t) => {
	// @ts-ignore
	const models = {
		room: {
			name: "string",
			creator: "@user",
			members: "@user[]",
			$type: "immutable",
		},
	} as ModelsInit
	new ModelDB(":memory:", models)

	t.pass()
})

test("create modeldb with a model with invalid fields should fail", (t) => {
	// @ts-ignore
	const models = {
		room: {
			name: "unsupported",
		},
	} as ModelsInit
	const error = t.throws(() => {
		new ModelDB(":memory:", models)
	})

	t.is(error!.message, `invalid property`)
})
