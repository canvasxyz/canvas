import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("query (select)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?" },
	})

	const [idA, idB] = [nanoid(), nanoid()]
	await db.set("user", idA, { address: "a", name: "John Doe" })
	await db.set("user", idB, { address: "b", name: null })

	t.deepEqual(await db.query("user", {}), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	t.deepEqual(await db.query("user", { select: {} }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { address: false } }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { name: false } }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { address: true } }), [{ address: "a" }, { address: "b" }])
	t.deepEqual(await db.query("user", { select: { address: true, name: false } }), [{ address: "a" }, { address: "b" }])
	t.deepEqual(await db.query("user", { select: { address: true, name: true } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
	t.deepEqual(await db.query("user", { select: { name: true } }), [{ name: "John Doe" }, { name: null }])
	t.deepEqual(await db.query("user", { select: { name: true, address: false } }), [
		{ name: "John Doe" },
		{ name: null },
	])
})

testOnModelDB("query (where)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?" },
	})

	const [idA, idB, idC] = [nanoid(), nanoid(), nanoid()]
	await db.set("user", idA, { address: "a", name: "John Doe" })
	await db.set("user", idB, { address: "b", name: null })
	await db.set("user", idC, { address: "c", name: "Jane Doe" })

	// Equality
	t.deepEqual(await db.query("user", { where: { address: "a" } }), [{ address: "a", name: "John Doe" }])
	t.deepEqual(await db.query("user", { where: { name: "John Doe" } }), [{ address: "a", name: "John Doe" }])
	t.deepEqual(await db.query("user", { where: { name: null } }), [{ address: "b", name: null }])

	// Negation
	t.deepEqual(await db.query("user", { where: { name: { neq: "John Doe" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	t.deepEqual(await db.query("user", { where: { name: { neq: null } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "c", name: "Jane Doe" },
	])
	t.deepEqual(await db.query("user", { where: { address: { neq: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])

	// Range
	t.deepEqual(await db.query("user", { where: { address: { gte: "a" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	t.deepEqual(await db.query("user", { where: { address: { gt: "a" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	t.deepEqual(await db.query("user", { where: { address: { gt: "a", lt: "c" } } }), [{ address: "b", name: null }])
	t.deepEqual(await db.query("user", { where: { address: { gt: "a", lte: "c" } } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])
	t.deepEqual(await db.query("user", { where: { address: { gte: "a", lt: "c" } } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
})

testOnModelDB("query (order by)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?" },
	})

	const [idA, idB, idC] = [nanoid(), nanoid(), nanoid()]
	await db.set("user", idA, { address: "a", name: "John Doe" })
	await db.set("user", idB, { address: "b", name: null })
	await db.set("user", idC, { address: "c", name: "Jane Doe" })

	// Ascending
	t.deepEqual(await db.query("user", { orderBy: { address: "asc" } }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])

	// Descending
	t.deepEqual(await db.query("user", { orderBy: { address: "desc" } }), [
		{ address: "c", name: "Jane Doe" },
		{ address: "b", name: null },
		{ address: "a", name: "John Doe" },
	])

	// Limits
	t.deepEqual(await db.query("user", { orderBy: { address: "desc" }, limit: 1 }), [{ address: "c", name: "Jane Doe" }])
	t.deepEqual(await db.query("user", { orderBy: { address: "asc" }, limit: 2 }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
})

// import { fc } from "@fast-check/ava"

// import {
// 	parseConfig,
// 	Model,
// 	ModelsInit,
// 	PrimitiveProperty,
// 	PrimitiveType,
// 	ModelValue,
// 	WhereCondition,
// } from "@canvas-js/modeldb-interface"
// import { testOnModelDB } from "./utils.js"

// const models: ModelsInit = {
// 	user: {
// 		name: "string",
// 		age: "integer",
// 		bio: "string",
// 		city: "string",
// 		$indexes: ["name", ["age", "name"], ["name", "bio"], ["age"]],
// 	},
// }

// const primitiveTypeArbitrary = (propertyType: PrimitiveType) => {
// 	let arbitrary: fc.Arbitrary<any>
// 	if (propertyType === "string") {
// 		arbitrary = fc.hexaString({ minLength: 1 })
// 	} else if (propertyType === "integer") {
// 		arbitrary = fc.integer()
// 	} else if (propertyType === "float") {
// 		arbitrary = fc.float()
// 	} else if (propertyType === "bytes") {
// 		arbitrary = fc.uint8Array()
// 	} else {
// 		throw new Error(`cannot generate arbitrary data for ${propertyType}`)
// 	}
// 	return arbitrary
// }

// const modelDataArbitrary = (model: Model) => {
// 	const primitiveProperties = model.properties.filter((x) => x.kind === "primitive") as PrimitiveProperty[]

// 	return fc.record(
// 		Object.fromEntries(primitiveProperties.map((property) => [property.name, primitiveTypeArbitrary(property.type)]))
// 	)
// }

// testOnModelDB("select queries return the selected fields", async (t, modelDBConstructor) => {
// 	const selectableFields = Object.keys(models.user).filter((x) => x !== "$type" && x !== "$indexes")
// 	const model = parseConfig(models).models[0]

// 	await fc.assert(
// 		fc.asyncProperty(
// 			fc.subarray(selectableFields, { minLength: 1 }),
// 			fc.array(modelDataArbitrary(model)),
// 			async (fieldsToSelect: string[], usersFixture: ModelValue[]) => {
// 				const db = await modelDBConstructor(models)

// 				for (const user of usersFixture) {
// 					await db.add("user", user)
// 				}

// 				const select: Record<string, boolean> = {}
// 				for (const field of fieldsToSelect) {
// 					select[field] = true
// 				}

// 				const result = await db.query("user", {
// 					select,
// 				})

// 				// assert that the selected fields are returned
// 				for (const row of result) {
// 					t.deepEqual(Object.keys(row).sort(), fieldsToSelect.sort())
// 				}
// 			}
// 		)
// 	)
// })

// testOnModelDB("select with no fields throws an error", async (t, modelDBConstructor) => {
// 	const db = await modelDBConstructor(models)

// 	const error = await t.throwsAsync(
// 		db.query("user", {
// 			select: {},
// 		})
// 	)

// 	t.is(error.message, "select must have at least one field")
// })

// testOnModelDB("select on a field that does not exist throws an error", async (t, modelDBConstructor) => {
// 	const db = await modelDBConstructor(models)

// 	const error = await t.throwsAsync(
// 		db.query("user", {
// 			select: {
// 				whatever: true,
// 			},
// 		})
// 	)

// 	t.is(error.message, "select field 'whatever' does not exist")
// })

// testOnModelDB("where clause lets us filter on indexed fields", async (t, modelDBConstructor) => {
// 	const model = parseConfig(models).models[0]
// 	const filterableFields = model.indexes

// 	await fc.assert(
// 		fc.asyncProperty(
// 			fc
// 				.constantFrom(...filterableFields)
// 				.chain(
// 					(fields: string[]): fc.Arbitrary<any> =>
// 						fc.record(
// 							Object.fromEntries(
// 								fields
// 									.map((field) => model.properties.find((x) => x.name === field) as PrimitiveProperty)
// 									.map((property) => [property.name, primitiveTypeArbitrary(property.type)])
// 							)
// 						)
// 				),
// 			fc.array(modelDataArbitrary(model)),
// 			fc.array(modelDataArbitrary(model)),
// 			async (where: WhereCondition, includedUsersFixture: ModelValue[], excludedUsersFixture: ModelValue[]) => {
// 				const db = await modelDBConstructor(models)

// 				for (const user of includedUsersFixture) {
// 					// for the values we want to include, replace the values we want to filter on
// 					await db.add("user", { ...user, ...where })
// 				}

// 				for (const user of excludedUsersFixture) {
// 					await db.add("user", user)
// 				}

// 				const result = await db.query("user", { where })

// 				// assert that the returned rows satisfy the where condition
// 				for (const row of result) {
// 					for (const field of Object.keys(where)) {
// 						t.is(row[field], where[field])
// 					}
// 				}
// 			}
// 		)
// 	)
// })

// testOnModelDB("order by on one field", async (t, modelDBConstructor) => {
// 	const orderableFields = Object.keys(models.user).filter((x) => x !== "$type" && x !== "$indexes")
// 	const model = parseConfig(models).models[0]

// 	await fc.assert(
// 		fc.asyncProperty(
// 			fc.constantFrom(...orderableFields),
// 			fc.array(modelDataArbitrary(model)),
// 			fc.constantFrom("asc", "desc") as fc.Arbitrary<"asc" | "desc">,
// 			async (orderByField: string, usersFixture: ModelValue[], direction: "asc" | "desc") => {
// 				const db = await modelDBConstructor(models)

// 				for (const user of usersFixture) {
// 					await db.add("user", user)
// 				}

// 				const result = await db.query("user", {
// 					orderBy: { [orderByField]: direction },
// 				})

// 				// assert that the field is sorted
// 				for (let i = 0; i < result.length; i++) {
// 					if (i > 0) {
// 						const currentValue = result[i][orderByField]
// 						const previousValue = result[i - 1][orderByField]
// 						if (currentValue !== null && previousValue !== null) {
// 							if (direction == "asc") {
// 								t.true(currentValue >= previousValue)
// 							} else {
// 								t.true(currentValue <= previousValue)
// 							}
// 						}
// 					}
// 				}
// 			}
// 		)
// 	)
// })
