import { ModelsInit } from "../src/types.js"
import { testOnModelDB } from "./utils.js"

// @ts-ignore
const models = {
	user: {
		name: "string",
		age: "integer",
		$type: "immutable",
	},
} as ModelsInit

testOnModelDB("query the database using select", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10 })

	t.deepEqual(
		await db.query("user", {
			select: { name: true },
		}),
		[
			{
				name: "test",
			},
		]
	)
})

testOnModelDB("query the database using select on multiple fields", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10 })

	t.deepEqual(
		await db.query("user", {
			select: { name: true, age: true },
		}),
		[
			{
				name: "test",
				age: 10,
			},
		]
	)
})

testOnModelDB("query the database using select on no fields", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10 })

	const error = await t.throwsAsync(
		db.query("user", {
			select: {},
		})
	)

	t.is(error.message, "select must have at least one field")
})
