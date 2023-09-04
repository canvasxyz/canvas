import { nanoid } from "nanoid"

import { testOnModelDB, v } from "./utils.js"

testOnModelDB("update a value without versions", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" })
	await db.set("user", key, { name: "John Doe" })
	t.deepEqual(await db.get("user", key), { name: "John Doe" })
})

testOnModelDB("set a value to a newer version", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" }, { version: v(0) })
	await db.set("user", key, { name: "John Doe" }, { version: v(1) })

	t.deepEqual(await db.get("user", key), { name: "John Doe" })
})

testOnModelDB("set a value to an older version", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" }, { version: v(1) })
	await db.set("user", key, { name: "John Doe" }, { version: v(0) })
	t.deepEqual(await db.get("user", key), { name: "John" })
})

testOnModelDB("delete a value without versions", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" })
	await db.delete("user", key)
	t.is(await db.get("user", key), null)
})

testOnModelDB("delete a value with a new version", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" }, { version: v(0) })
	await db.delete("user", key, { version: v(1) })
	t.is(await db.get("user", key), null)
})

testOnModelDB("delete a value with an old version", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.set("user", key, { name: "John" }, { version: v(1) })
	await db.delete("user", key, { version: v(0) })
	t.deepEqual(await db.get("user", key), { name: "John" })
})

testOnModelDB("delete a value with a new version before setting an older version", async (t, openDB) => {
	const db = await openDB({
		user: { name: "string" },
	})

	const key = nanoid()

	await db.delete("user", key, { version: v(1) })
	t.is(await db.get("user", key), null)

	await db.set("user", key, { name: "John" }, { version: v(0) })
	t.is(await db.get("user", key), null)
})
