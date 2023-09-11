import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("query (select)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?" },
	})

	const [a, b] = [nanoid(), nanoid()]
	await db.set("user", "a", { address: a, name: "John Doe" })
	await db.set("user", "b", { address: b, name: null })

	t.deepEqual(await db.query("user", {}), [
		{ address: a, name: "John Doe" },
		{ address: b, name: null },
	])

	t.deepEqual(await db.query("user", { select: {} }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { address: false } }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { name: false } }), [{}, {}])
	t.deepEqual(await db.query("user", { select: { address: true } }), [{ address: a }, { address: b }])
	t.deepEqual(await db.query("user", { select: { address: true, name: false } }), [{ address: a }, { address: b }])
	t.deepEqual(await db.query("user", { select: { address: true, name: true } }), [
		{ address: a, name: "John Doe" },
		{ address: b, name: null },
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

	await db.set("user", "x", { address: "a", name: "John Doe" })
	await db.set("user", "y", { address: "b", name: null })
	await db.set("user", "z", { address: "c", name: "Jane Doe" })

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
