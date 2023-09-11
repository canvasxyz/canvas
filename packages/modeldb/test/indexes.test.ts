import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("query (indexed where)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?", $indexes: ["address", "name"] },
	})

	await db.set("user", "x", { address: "a", name: "John Doe" })
	await db.set("user", "y", { address: "b", name: null })
	await db.set("user", "z", { address: "c", name: "Jane Doe" })

	// Equality
	t.deepEqual(await db.query("user", { where: { address: "a" } }), [{ address: "a", name: "John Doe" }])
	t.deepEqual(await db.query("user", { where: { name: "John Doe" } }), [{ address: "a", name: "John Doe" }])
	t.deepEqual(await db.query("user", { where: { name: null } }), [{ address: "b", name: null }])

	// Negation
	t.deepEqual(await db.query("user", { where: { name: { neq: "John Doe" } }, orderBy: { name: "asc" } }), [
		{ address: "b", name: null },
		{ address: "c", name: "Jane Doe" },
	])

	t.deepEqual(await db.query("user", { where: { name: { neq: null } }, orderBy: { name: "asc" } }), [
		{ address: "c", name: "Jane Doe" },
		{ address: "a", name: "John Doe" },
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

testOnModelDB("query (indexed order by)", async (t, openDB) => {
	const db = await openDB({
		user: { address: "string", name: "string?", $indexes: ["address", "name"] },
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
