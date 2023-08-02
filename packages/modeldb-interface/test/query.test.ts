import { Model, ModelsInit, PrimitiveProperty } from "../src/types.js"
import { compareUnordered, testOnModelDB } from "./utils.js"
import * as fc from "fast-check"

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

const modelDataArbitrary = (modelName: string, modelsInit: ModelsInit) => {
	const modelInit = modelsInit[modelName]
	const propertyNames = Object.keys(modelInit).filter((x) => x !== "$type" && x !== "$indexes")

	return fc.record(
		Object.fromEntries(
			propertyNames.map((propertyName) => {
				const propertyType = modelInit[propertyName]

				let arbitrary: fc.Arbitrary<any>
				if (propertyType === "string") {
					arbitrary = fc.string()
				} else if (propertyType === "integer") {
					arbitrary = fc.integer()
				} else if (propertyType === "float") {
					arbitrary = fc.float()
				} else if (propertyType === "bytes") {
					arbitrary = fc.uint8Array()
				} else {
					throw new Error(`cannot generate arbitrary data for ${propertyType}`)
				}

				return [propertyName, arbitrary]
			})
		)
	)
}

testOnModelDB("select queries return the selected fields", async (t, modelDBConstructor) => {
	const selectableFields = Object.keys(models.user).filter((x) => x !== "$type" && x !== "$indexes")

	await fc.assert(
		fc.asyncProperty(
			fc.subarray(selectableFields, { minLength: 1 }),
			fc.array(modelDataArbitrary("user", models)),
			async (fieldsToSelect, usersFixture) => {
				const db = await modelDBConstructor(models)

				for (const user of usersFixture) {
					await db.add("user", user)
				}

				const select: Record<string, boolean> = {}
				for (const field of fieldsToSelect) {
					select[field] = true
				}

				const result = await db.query("user", {
					select,
				})

				// assert that the selected fields are returned
				for (const row of result) {
					t.deepEqual(Object.keys(row).sort(), fieldsToSelect.sort())
				}
			}
		)
	)
})

testOnModelDB("select with no fields throws an error", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	const error = await t.throwsAsync(
		db.query("user", {
			select: {},
		})
	)

	t.is(error.message, "select must have at least one field")
})

testOnModelDB("select on a field that does not exist throws an error", async (t, modelDBConstructor) => {
	const db = await modelDBConstructor(models)

	const error = await t.throwsAsync(
		db.query("user", {
			select: {
				whatever: true,
			},
		})
	)

	t.is(error.message, "select field 'whatever' does not exist")
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
