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
		$indexes: ["name", ["age", "name"], ["name", "bio"]],
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

	await db.add("user", { name: "test", age: 1, bio: "bio1", city: "new york" })
	await db.add("user", { name: "test", age: 2, bio: "bio2", city: "london" })
	await db.add("user", { name: "test2", age: 3, bio: "bio3", city: "tokyo" })

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
				age: 1,
			},
			{
				name: "test",
				age: 2,
			},
		]
	)
})

testOnModelDB(
	"query the database filtering on one field with where on multiple conditions",
	async (t, modelDBConstructor) => {
		const db = await modelDBConstructor(models)

		await db.add("user", { name: "test", age: 1, bio: "bio1", city: "new york" })
		await db.add("user", { name: "test", age: 2, bio: "bio2", city: "london" })
		await db.add("user", { name: "test2", age: 3, bio: "bio3", city: "tokyo" })

		compareUnordered(
			t,
			await db.query("user", {
				where: {
					name: "test",
					age: 2,
				},
			}),
			[
				{
					name: "test",
					age: 2,
					bio: "bio2",
					city: "london",
				},
			]
		)

		compareUnordered(
			t,
			await db.query("user", {
				where: {
					bio: "bio1",
					name: "test",
				},
				select: {
					name: true,
					bio: true,
				},
			}),
			[
				{
					name: "test",
					bio: "bio1",
				},
			]
		)
	}
)

testOnModelDB("query the database ordering by one field ascending", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 1, bio: "bio1", city: "new york" })
	await db.add("user", { name: "test", age: 2, bio: "bio2", city: "london" })
	await db.add("user", { name: "test2", age: 3, bio: "bio3", city: "tokyo" })

	t.deepEqual(
		await db.query("user", {
			select: {
				name: true,
				age: true,
			},
			orderBy: {
				age: "asc",
			},
		}),
		[
			{ name: "test", age: 1 },
			{ name: "test", age: 2 },
			{ name: "test2", age: 3 },
		]
	)
})

testOnModelDB("query the database ordering by one field descending", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	await db.add("user", { name: "test", age: 1, bio: "bio1", city: "new york" })
	await db.add("user", { name: "test", age: 2, bio: "bio2", city: "london" })
	await db.add("user", { name: "test2", age: 3, bio: "bio3", city: "tokyo" })

	t.deepEqual(
		await db.query("user", {
			select: {
				name: true,
				age: true,
			},
			orderBy: {
				age: "desc",
			},
		}),
		[
			{ name: "test2", age: 3 },
			{ name: "test", age: 2 },
			{ name: "test", age: 1 },
		]
	)
})
