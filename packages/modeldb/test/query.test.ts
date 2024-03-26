import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("query (select)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { id: "primary", isModerator: "boolean", name: "string?" },
	})

	const [a, b] = ["a", "b"]
	await db.set("user", { id: a, isModerator: true, name: "John Doe" })
	await db.set("user", { id: b, isModerator: false, name: null })

	t.deepEqual(await db.query("user", {}), [
		{ id: a, isModerator: true, name: "John Doe" },
		{ id: b, isModerator: false, name: null },
	])

	t.deepEqual(await db.query("user", { select: { id: true } }), [{ id: a }, { id: b }])
	t.deepEqual(await db.query("user", { select: { id: true, name: false } }), [{ id: a }, { id: b }])
	t.deepEqual(await db.query("user", { select: { id: true, isModerator: true, name: true } }), [
		{ id: a, isModerator: true, name: "John Doe" },
		{ id: b, isModerator: false, name: null },
	])
	t.deepEqual(await db.query("user", { select: { id: true, name: true } }), [
		{ id: a, name: "John Doe" },
		{ id: b, name: null },
	])
})

testOnModelDB("query (where)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary", name: "string?" },
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

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

	// Multiple filters
	t.deepEqual(await db.query("user", { where: { name: { neq: null }, address: { gt: "a" } } }), [
		{ address: "c", name: "Jane Doe" },
	])

	t.deepEqual(await db.query("user", { where: { address: { lte: "b" }, name: { gt: null } } }), [
		{ address: "a", name: "John Doe" },
	])
})

testOnModelDB("query (order by)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary", name: "string?" },
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

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

	// Ascending with nulls
	t.deepEqual(await db.query("user", { orderBy: { name: "asc" } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
		{ address: "a", name: "John Doe" },
	])

	// Descending with nulls
	t.deepEqual(await db.query("user", { orderBy: { name: "desc" } }), [
		{ address: "a", name: "John Doe" },
		{ address: "c", name: "Jane Doe" },
		{ address: "b", name: null },
	])

	// Limits
	t.deepEqual(await db.query("user", { orderBy: { address: "desc" }, limit: 1 }), [{ address: "c", name: "Jane Doe" }])
	t.deepEqual(await db.query("user", { orderBy: { address: "asc" }, limit: 2 }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
})

testOnModelDB("query should not be able to query on json fields", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary", metadata: "json" },
	})
	await t.throwsAsync(async () => {
		await db.query("user", { where: { metadata: "something" } })
	})
})
