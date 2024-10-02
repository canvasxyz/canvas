import { testOnModelDB } from "./utils.js"

testOnModelDB("get many (simple table)", async (t, openDB) => {
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

testOnModelDB("get many (with relations)", async (t, openDB) => {
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
