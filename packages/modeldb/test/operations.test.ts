import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("get fields of all types", async (t, openDB) => {
	const db = await openDB(t, {
		foo: {
			id: "primary",
			exampleStr: "string",
			exampleBool: "boolean",
			exampleInt: "integer",
			exampleFloat: "float",
			exampleNumber: "number",
			exampleJson: "json",
			exampleBytes: "bytes",
		},
	})

	const id = nanoid()

	const jsonValue = { foo: "a", bar: "b", qux: null, baz: 0.3 }
	await db.set("foo", {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: Math.PI,
		exampleNumber: 0.1,
		exampleJson: jsonValue,
		exampleBytes: new Uint8Array([0, 255]),
	})

	const result = await db.get("foo", id)

	t.deepEqual(result, {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: Math.PI,
		exampleNumber: 0.1,
		exampleJson: jsonValue,
		exampleBytes: new Uint8Array([0, 255]),
	})
})

testOnModelDB("update a value", async (t, openDB) => {
	const db = await openDB(t, {
		user: {
			id: "primary",
			name: "string",
			isModerator: "boolean",
		},
	})

	const id = nanoid()

	await db.set("user", { id, name: "John", isModerator: false })
	await db.set("user", { id, name: "John Doe", isModerator: true })
	t.deepEqual(await db.get("user", id), { id, isModerator: true, name: "John Doe" })
})

testOnModelDB("delete a value ", async (t, openDB) => {
	const db = await openDB(t, {
		user: { id: "primary", name: "string" },
	})

	const id = nanoid()

	await db.set("user", { id, name: "John" })
	t.is(await db.count("user"), 1)

	await db.delete("user", id)
	t.is(await db.get("user", id), null)
	t.is(await db.count("user"), 0)

	await db.delete("user", id)
	t.is(await db.get("user", id), null)
	t.is(await db.count("user"), 0)
})

testOnModelDB("set and get an integer primary key", async (t, openDB) => {
	const db = await openDB(t, {
		user: { $primary: "id", id: "integer", name: "string?" },
	})

	await db.set("user", { id: 0, name: null })
	await db.set("user", { id: 3, name: null })
	await db.set("user", { id: 10, name: "John Doe" })

	t.deepEqual(await db.query("user"), [
		{ id: 0, name: null },
		{ id: 3, name: null },
		{ id: 10, name: "John Doe" },
	])
})
