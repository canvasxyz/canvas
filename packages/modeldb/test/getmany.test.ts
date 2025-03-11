import { testPlatforms } from "./utils.js"

testPlatforms("get many (simple table)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { id: "primary", is_moderator: "boolean", name: "string?" },
	})

	const [a, b, c] = ["a", "b", "c"]
	const d = "d"
	await db.set("user", { id: a, is_moderator: true, name: "John Doe" })
	await db.set("user", { id: b, is_moderator: false, name: null })
	await db.set("user", { id: c, is_moderator: false, name: null })

	t.deepEqual(await db.getMany("user", []), [])
	t.deepEqual(await db.getMany("user", [d]), [null])
	t.deepEqual(await db.getMany("user", [a, b]), [
		{ id: a, is_moderator: true, name: "John Doe" },
		{ id: b, is_moderator: false, name: null },
	])
	t.deepEqual(await db.getMany("user", [b, a]), [
		{ id: b, is_moderator: false, name: null },
		{ id: a, is_moderator: true, name: "John Doe" },
	])
	t.deepEqual(await db.getMany("user", [a, b, c]), [
		{ id: a, is_moderator: true, name: "John Doe" },
		{ id: b, is_moderator: false, name: null },
		{ id: c, is_moderator: false, name: null },
	])
})

testPlatforms("get many (composite primary key)", async (t, openDB) => {
	const db = await openDB(t, {
		user: {
			$primary: "id/index",
			id: "string",
			index: "integer",
			name: "string?",
		},
	})

	const [a, b, c] = ["a", "b", "c"]
	const d = "d"
	await db.set("user", { id: a, index: 0, name: "John Doe" })
	await db.set("user", { id: b, index: 0, name: null })
	await db.set("user", { id: b, index: 1, name: null })

	t.deepEqual(await db.getMany("user", []), [])
	t.deepEqual(await db.getMany("user", [[d, 0]]), [null])
	t.deepEqual(
		await db.getMany("user", [
			[d, 0],
			[a, 1],
		]),
		[null, null],
	)
	t.deepEqual(
		await db.getMany("user", [
			[a, 0],
			[b, 0],
		]),
		[
			{ id: a, index: 0, name: "John Doe" },
			{ id: b, index: 0, name: null },
		],
	)
	t.deepEqual(
		await db.getMany("user", [
			[a, 0],
			[a, 1],
			[b, 0],
			[b, 1],
		]),
		[{ id: a, index: 0, name: "John Doe" }, null, { id: b, index: 0, name: null }, { id: b, index: 1, name: null }],
	)
})

testPlatforms("get many (with relations)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { address: "primary" },
		room: {
			id: "primary",
			creator: "@user",
			members: "@user[]",
		},
	})

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })
	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })

	t.deepEqual(await db.getMany("user", ["a"]), [{ address: "a" }])
	t.deepEqual(await db.getMany("user", ["a", "b"]), [{ address: "a" }, { address: "b" }])
	t.deepEqual(await db.getMany("room", ["x", "y", "z"]), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "y", creator: "b", members: ["b", "c"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])
})
