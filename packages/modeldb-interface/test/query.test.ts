import { ModelsInit } from "../src/types.js"
import { testOnModelDB } from "./utils.js"

// @ts-ignore
const models = {
	user: {
		name: "string",
		age: "integer",
		$type: "immutable",
		$indexes: ["name"],
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

testOnModelDB("query the database filtering on one field with where", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10 })
	await db.add("user", { name: "test", age: 14 })

	t.deepEqual(
		await db.query("user", {
			where: {
				name: "test",
			},
		}),
		[
			{
				name: "test",
				age: 10,
			},
			{
				name: "test",
				age: 14,
			},
		]
	)
})
