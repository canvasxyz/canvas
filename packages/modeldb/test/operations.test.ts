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

testOnModelDB("set and get a composite primary key", async (t, openDB) => {
	const db = await openDB(t, {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?" },
	})

	await db.set("user", { key: "a", index: 0, name: null })
	await db.set("user", { key: "b", index: 3, name: null })
	await db.set("user", { key: "b", index: 10, name: "John Doe" })

	t.deepEqual(await db.get("user", ["a", 0]), { key: "a", index: 0, name: null })
	t.deepEqual(await db.get("user", ["b", 3]), { key: "b", index: 3, name: null })
	t.deepEqual(await db.get("user", ["b", 10]), { key: "b", index: 10, name: "John Doe" })
	t.deepEqual(await db.get("user", ["c", 10]), null)

	t.deepEqual(await db.query("user"), [
		{ key: "a", index: 0, name: null },
		{ key: "b", index: 3, name: null },
		{ key: "b", index: 10, name: "John Doe" },
	])
})

testOnModelDB("set and get a reference to a composite primary key", async (t, openDB) => {
	const db = await openDB(t, {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?" },
		room: { $primary: "key/index", key: "string", index: "integer", creator: "@user" },
	})

	await db.set("user", { key: "a", index: 0, name: null })
	await db.set("user", { key: "b", index: 3, name: null })
	await db.set("user", { key: "b", index: 10, name: "John Doe" })

	await db.set("room", { key: "x", index: 0, creator: ["a", 0] })
	await db.set("room", { key: "x", index: 1, creator: ["a", 0] })
	await db.set("room", { key: "y", index: 1, creator: ["b", 10] })

	t.deepEqual(await db.query("user"), [
		{ key: "a", index: 0, name: null },
		{ key: "b", index: 3, name: null },
		{ key: "b", index: 10, name: "John Doe" },
	])

	t.deepEqual(await db.query("room"), [
		{ key: "x", index: 0, creator: ["a", 0] },
		{ key: "x", index: 1, creator: ["a", 0] },
		{ key: "y", index: 1, creator: ["b", 10] },
	])
})

testOnModelDB("set and get a relation on a composite primary key", async (t, openDB) => {
	const db = await openDB(t, {
		user: { $primary: "key/index", key: "string", index: "integer", name: "string?" },
		room: { $primary: "key/index", key: "string", index: "integer", creator: "@user", members: "@room[]" },
	})

	await db.set("user", { key: "a", index: 0, name: null })
	await db.set("user", { key: "b", index: 3, name: null })
	await db.set("user", { key: "b", index: 10, name: "John Doe" })

	await db.set("room", { key: "x", index: 0, creator: ["a", 0], members: [["a", 0]] })
	await db.set("room", { key: "x", index: 1, creator: ["a", 0], members: [["a", 0]] })
	await db.set("room", { key: "y", index: 1, creator: ["b", 10], members: [["b", 10]] })

	t.deepEqual(await db.query("room"), [
		{ key: "x", index: 0, creator: ["a", 0], members: [["a", 0]] },
		{ key: "x", index: 1, creator: ["a", 0], members: [["a", 0]] },
		{ key: "y", index: 1, creator: ["b", 10], members: [["b", 10]] },
	])

	await db.update("room", {
		key: "x",
		index: 1,
		members: [
			["a", 0],
			["b", 3],
			["b", 10],
		],
	})

	t.deepEqual(await db.get("room", ["x", 1]), {
		key: "x",
		index: 1,
		creator: ["a", 0],
		members: [
			["a", 0],
			["b", 3],
			["b", 10],
		],
	})

	await db.update("room", {
		key: "x",
		index: 1,
		members: [
			["a", 0],
			["b", 10],
		],
	})

	t.deepEqual(await db.get("room", ["x", 1]), {
		key: "x",
		index: 1,
		creator: ["a", 0],
		members: [
			["a", 0],
			["b", 10],
		],
	})
})

testOnModelDB("set and get top-level string JSON values", async (t, openDB) => {
	const db = await openDB(t, {
		foo: { id: "primary", value: "json" },
	})

	await db.set("foo", { id: "abc", value: "hello world" })
	t.deepEqual(await db.get("foo", "abc"), { id: "abc", value: "hello world" })
})

testOnModelDB("get all values", async (t, openDB) => {
	const db = await openDB(t, {
		user: { $primary: "id/index", id: "integer", index: "integer", name: "string?" },
	})

	await db.set("user", { id: 3, index: 9, name: null })
	await db.set("user", { id: 10, index: 9, name: "John Doe" })
	await db.set("user", { id: 0, index: 9, name: null })

	t.deepEqual(await db.getAll("user"), [
		{ id: 0, index: 9, name: null },
		{ id: 3, index: 9, name: null },
		{ id: 10, index: 9, name: "John Doe" },
	])
})
