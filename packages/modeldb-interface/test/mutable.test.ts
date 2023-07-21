// tests for modeldbs with mutable models
import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

async function toArray(asyncIterator: any) {
	const arr = []
	for await (const i of asyncIterator) arr.push(i)
	return arr
}

testOnModelDB("create a modeldb with a mutable model and a valid entry", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "mutable",
		},
	} as ModelsInit
	const db = await modelDBConstructor(models)

	const key = "modelKey"

	// add a user
	db.set("user", key, { name: "test" })

	// get the user
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "test" }])

	// // delete the user
	db.delete("user", key)

	// assert user has been deleted
	t.deepEqual(await toArray(db.iterate("user")), [])

	// set a new value
	db.set("user", key, { name: "newValue" })
	// get the user
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "newValue" }])

	// overwrite the variable
	db.set("user", key, { name: "newValue2" })
	// get the user
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "newValue2" }])
})

testOnModelDB("create a modeldb with a mutable model and a resolve function", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "mutable",
		},
	} as ModelsInit
	const db = await modelDBConstructor(models, { resolve: (a: any, b: any) => (a > b ? a : b) })

	const key = "modelKey"

	// add a user
	await db.set("user", key, { name: "initialValue" }, { version: "A" })
	// the user should have been created with the initial value
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "initialValue" }])

	// set a new value with a higher version
	await db.set("user", key, { name: "updatedValue" }, { version: "C" })
	// the user's value should be updated
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "updatedValue" }])

	// try to set a new value with a lower version
	await db.set("user", key, { name: "staleValue" }, { version: "B" })
	// the user should have the previous value
	t.deepEqual(await toArray(db.iterate("user")), [{ name: "updatedValue" }])
})

testOnModelDB("create a modeldb with a mutable model and an invalid entry", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		user: {
			name: "string",
			$type: "mutable",
		},
	} as ModelsInit
	const db = await modelDBConstructor(models)

	const key = "modelKey2"
	// add a user
	const error = await t.throwsAsync(() => db.set("user", key, { something: "test" }))
	t.is(error!.message, `missing value for property user/name`)
})
