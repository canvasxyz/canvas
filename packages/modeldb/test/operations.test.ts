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
			exampleJson: "json",
			exampleBytes: "bytes",
		},
	})

	const id = nanoid()

	await db.set("foo", {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: 0.1,
		exampleJson: JSON.stringify({ foo: "a", bar: "b", qux: null, baz: 0.3 }),
		exampleBytes: new Uint8Array([0, 255]),
	})

	const result = await db.get("foo", id)

	t.deepEqual(result, {
		id,
		exampleStr: "hello world",
		exampleBool: true,
		exampleInt: -1,
		exampleFloat: 0.1,
		exampleJson: result?.exampleJson,
		exampleBytes: new Uint8Array([0, 255]),
	})

	// assumes stable serialization
	t.deepEqual(JSON.parse(result?.exampleJson as "string"), { foo: "a", bar: "b", qux: null, baz: 0.3 })
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
})
