import {
	parseConfig,
	Model,
	ModelsInit,
	PrimitiveProperty,
	PropertyValue,
	PrimitiveType,
	WhereEqualityCondition,
	WhereInequalityCondition,
	isWhereInequalityCondition,
	PrimitiveValue,
	InequalityOperator,
} from "@canvas-js/modeldb-interface"
import { compareUnordered, testOnModelDB } from "./utils.js"
import * as fc from "fast-check"
import { ExecutionContext } from "ava"
import assert from "assert"

// @ts-ignore
const models = {
	user: {
		// name: "string",
		age: "integer",
		// bio: "string",
		// city: "string",
		$type: "immutable",
		// ["name", ["age", "name"], ["name", "bio"]]
		$indexes: ["age"],
	},
} as ModelsInit

const primitiveTypeArbitrary = (propertyType: PrimitiveType) => {
	let arbitrary: fc.Arbitrary<any>
	if (propertyType === "string") {
		arbitrary = fc.hexaString({ minLength: 1 })
	} else if (propertyType === "integer") {
		arbitrary = fc.integer()
	} else if (propertyType === "float") {
		arbitrary = fc.float()
	} else if (propertyType === "bytes") {
		arbitrary = fc.uint8Array()
	} else {
		throw new Error(`cannot generate arbitrary data for ${propertyType}`)
	}
	return arbitrary
}

const modelDataArbitrary = (model: Model) => {
	const primitiveProperties = model.properties.filter((x) => x.kind === "primitive") as PrimitiveProperty[]

	return fc.record(
		Object.fromEntries(primitiveProperties.map((property) => [property.name, primitiveTypeArbitrary(property.type)]))
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
			fc
				.constantFrom(...filterableFields)
				.chain(
					(fields): fc.Arbitrary<WhereEqualityCondition> =>
						fc.record(
							Object.fromEntries(
								fields
									.map((field) => model.properties.find((x) => x.name === field) as PrimitiveProperty)
									.map((property) => [property.name, primitiveTypeArbitrary(property.type)])
							)
						)
				),
			fc.array(modelDataArbitrary(model)),
			fc.array(modelDataArbitrary(model)),
			async (where, includedUsersFixture, excludedUsersFixture) => {
				const db = await modelDBConstructor(models)

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

				// assert that the returned rows satisfy the where condition
				for (const row of result) {
					if (isWhereInequalityCondition(where)) {
					} else {
						for (const field of Object.keys(where)) {
							t.is(row[field], where[field])
						}
					}
				}
			}
		)
	)
})

const fcOrderedTriple = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T[]> =>
	fc.uniqueArray(arb, { minLength: 3, maxLength: 3 }).chain((values) => {
		values.sort((a, b) => (a < b ? -1 : 1))
		assert(values.length === 3)
		assert(values[0] <= values[1])
		assert(values[1] <= values[2])
		return fc.constant([values[0], values[1], values[2]])
	})

testOnModelDB(
	"where clause lets us filter on indexed fields with inequalities",
	async (t: ExecutionContext, modelDBConstructor) => {
		const model = parseConfig(models).models[0]
		const inequalityFilterableFields = model.indexes
			.filter((x) => x.length === 1)
			.map((fields) => model.properties.find((property) => property.name === fields[0]))
			.filter((property): property is PrimitiveProperty => property !== undefined && property.kind === "primitive")

		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(...inequalityFilterableFields).chain(
					(property): fc.Arbitrary<[PrimitiveValue, WhereInequalityCondition]> =>
						fcOrderedTriple(primitiveTypeArbitrary(property.type)).chain(
							([small, medium, large]: PrimitiveValue[]): fc.Arbitrary<[PrimitiveValue, WhereInequalityCondition]> => {
								console.log([small, medium, large])
								return fc.tuple(
									fc.constant(medium),
									fc.oneof(
										fc.record({
											[property.name]: fc.record({
												lt: fc.constant(large),
												gt: fc.constant(small),
											}),
										}),
										fc.record({
											[property.name]: fc.record({
												lte: fc.constant(large),
												gte: fc.constant(small),
											}),
										})
									)
								)
							}
						)
				),
				fc.array(modelDataArbitrary(model), { minLength: 1 }),
				fc.array(modelDataArbitrary(model)),
				async ([middleValue, where], includedUsersFixture, excludedUsersFixture) => {
					const db = await modelDBConstructor(models)

					console.log([middleValue, where])

					console.log(`middleValue: ${middleValue}`)

					const field = Object.keys(where)[0]

					for (const user of includedUsersFixture) {
						const u = { ...user, [field]: middleValue }
						console.log(u)
						await db.add("user", u)
					}

					for (const user of excludedUsersFixture) {
						await db.add("user", user)
					}

					const result = await db.query("user", {
						where,
					})

					// assert that the returned rows satify the where condition

					const predicate = where[field]
					console.log(result, predicate)

					for (const row of result) {
						const value = row[field]
						if (value == null) {
							continue
						}

						if (predicate.neq) {
							t.not(value, predicate.neq)
						}
						if (predicate.lt) {
							t.assert(value < predicate.lt)
						}
						if (predicate.lte) {
							t.assert(value <= predicate.lte)
						}
						if (predicate.gt) {
							t.assert(value > predicate.gt)
						}
						if (predicate.gte) {
							t.assert(value >= predicate.gte)
						}
					}
				}
			)
		)
	}
)

testOnModelDB("order by on one field", async (t, modelDBConstructor) => {
	const orderableFields = Object.keys(models.user).filter((x) => x !== "$type" && x !== "$indexes")
	const model = parseConfig(models).models[0]

	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom(...orderableFields),
			fc.array(modelDataArbitrary(model)),
			fc.constantFrom("asc", "desc"),
			async (orderByField, usersFixture, direction) => {
				const db = await modelDBConstructor(models)

				for (const user of usersFixture) {
					await db.add("user", user)
				}

				const result = await db.query("user", {
					orderBy: { [orderByField]: direction },
				})

				// assert that the field is sorted
				for (let i = 0; i < result.length; i++) {
					if (i > 0) {
						const currentValue = result[i][orderByField]
						const previousValue = result[i - 1][orderByField]
						if (currentValue !== null && previousValue !== null) {
							if (direction == "asc") {
								t.true(currentValue >= previousValue)
							} else {
								t.true(currentValue <= previousValue)
							}
						}
					}
				}
			}
		)
	)
})
