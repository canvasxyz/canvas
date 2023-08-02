import { parseConfig, Model, ModelsInit, PrimitiveProperty, PropertyValue } from "@canvas-js/modeldb-interface"
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

const modelDataArbitrary = (model: Model) => {
	const primitiveProperties = model.properties.filter((x) => x.kind === "primitive") as PrimitiveProperty[]

	return fc.record(
		Object.fromEntries(
			primitiveProperties.map((property) => {
				let arbitrary: fc.Arbitrary<any>
				if (property.type === "string") {
					arbitrary = fc.string({ minLength: 1 })
				} else if (property.type === "integer") {
					arbitrary = fc.integer()
				} else if (property.type === "float") {
					arbitrary = fc.float()
				} else if (property.type === "bytes") {
					arbitrary = fc.uint8Array()
				} else {
					throw new Error(`cannot generate arbitrary data for ${property.type}`)
				}

				return [property.name, arbitrary]
			})
		)
	)
}

testOnModelDB("select queries return the selected fields", async (t, modelDBConstructor) => {
	const selectableFields = Object.keys(models.user).filter((x) => x !== "$type" && x !== "$indexes")
	const model = parseConfig(models).models[0]

	await fc.assert(
		fc.asyncProperty(
			fc.subarray(selectableFields, { minLength: 1 }),
			fc.array(modelDataArbitrary(model)),
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

testOnModelDB("where clause lets us filter on indexed fields", async (t, modelDBConstructor) => {
	const model = parseConfig(models).models[0]
	const filterableFields = model.indexes

	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom(...filterableFields),
			modelDataArbitrary(model),
			fc.array(modelDataArbitrary(model)),
			fc.array(modelDataArbitrary(model)),
			async (fieldsToWhere, valuesToWhere, includedUsersFixture, excludedUsersFixture) => {
				const db = await modelDBConstructor(models)

				const where: Record<string, PropertyValue> = {}
				for (const field of fieldsToWhere) {
					where[field] = valuesToWhere[field]
				}

				for (const user of includedUsersFixture) {
					// for the values we want to include, replace the values we want to filter on
					await db.add("user", { ...user, ...where })
				}

				for (const user of excludedUsersFixture) {
					await db.add("user", user)
				}

				const result = await db.query("user", {
					where,
				})

				// assert that the returned rows satify the where condition
				for (const row of result) {
					for (const field of Object.keys(where)) {
						t.is(row[field], where[field])
					}
				}
			}
		)
	)
})

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
