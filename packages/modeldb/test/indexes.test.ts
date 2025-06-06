import { testPlatforms } from "./utils.js"

testPlatforms("query (indexed where)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary", name: "string?", $indexes: ["address", "name"] },
	})

	await db.set("user", { address: "a", name: "John Doe" })
	await db.set("user", { address: "b", name: null })
	await db.set("user", { address: "c", name: "Jane Doe" })

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

testPlatforms("query (indexed order by)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary", name: "string?", $indexes: ["address", "name"] },
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

	// Limits
	t.deepEqual(await db.query("user", { orderBy: { address: "desc" }, limit: 1 }), [{ address: "c", name: "Jane Doe" }])
	t.deepEqual(await db.query("user", { orderBy: { address: "asc" }, limit: 2 }), [
		{ address: "a", name: "John Doe" },
		{ address: "b", name: null },
	])
})

testPlatforms("composite index", async (t, openDB) => {
	const db = await openDB(t, {
		user: {
			id: "primary",
			value: "integer",
			$indexes: ["value/id"],
		},
	})

	await db.set("user", { id: "a", value: 0 })
	await db.set("user", { id: "b", value: 1 })
	await db.set("user", { id: "c", value: 1 })
	await db.set("user", { id: "d", value: 1 })
	await db.set("user", { id: "e", value: 1 })
	await db.set("user", { id: "f", value: 4 })

	t.deepEqual(
		await db.query("user", {
			orderBy: { "value/id": "asc" },
			where: { value: 1 },
		}),
		[
			{ id: "b", value: 1 },
			{ id: "c", value: 1 },
			{ id: "d", value: 1 },
			{ id: "e", value: 1 },
		],
	)

	t.deepEqual(
		await db.query("user", {
			orderBy: { "value/id": "asc" },
			where: { value: 1, id: { gt: "a", lte: "d" } },
		}),
		[
			{ id: "b", value: 1 },
			{ id: "c", value: 1 },
			{ id: "d", value: 1 },
		],
	)
})
