import { ModelsInit } from "../src/types.js"
import { compareUnordered, testOnModelDB } from "./utils.js"

// @ts-ignore
const models = {
	user: {
		name: "string",
		age: "integer",
		bio: "string",
		city: "string",
		$type: "immutable",
		$indexes: ["name"],
	},
} as ModelsInit

testOnModelDB("query the database using select", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 10, bio: "i love to read books!", city: "vancouver washington" })

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

	await db.add("user", { name: "test", age: 10, bio: "where is my mind", city: "south san francisco" })

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

	await db.add("user", { name: "test", age: 10, bio: "i'm here to make friends", city: "milton keynes" })

	const error = await t.throwsAsync(
		db.query("user", {
			select: {},
		})
	)

	t.is(error.message, "select must have at least one field")
})

testOnModelDB("query the database filtering on one field with where", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 56, bio: "opinions belong to me and not my employer", city: "langley va" })
	await db.add("user", {
		name: "test",
		age: 14,
		bio: "i'm not here to talk to you. i'm here to talk to your dog",
		city: "melbourne",
	})

	await db.add("user", {
		name: "someone",
		age: 59,
		bio: "I don't believe in happy endings, but I do believe in happy travels, because ultimately, you die at a very young age, or you live long enough to watch your friends die. It's a mean thing, life.",
		city: "lexington kentucky",
	})

	compareUnordered(
		t,
		await db.query("user", {
			where: {
				name: "test",
			},
			select: {
				name: true,
				age: true,
			},
		}),
		[
			{
				name: "test",
				age: 56,
			},
			{
				name: "test",
				age: 14,
			},
		]
	)
})
