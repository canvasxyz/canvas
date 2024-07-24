import { nanoid } from "nanoid"
import { testOnModelDB } from "./utils.js"

testOnModelDB("set and get reference and relation values", async (t, openDB) => {
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

	t.is(await db.count("user"), 2)

	const roomId = nanoid()
	await db.set("room", { id: roomId, creator: "a", members: ["a", "b"] })
	t.deepEqual(await db.get("room", roomId), { id: roomId, creator: "a", members: ["a", "b"] })
})

testOnModelDB("select reference and relation values", async (t, openDB) => {
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

	t.deepEqual(await db.query("room", { select: { id: true, creator: true } }), [
		{ id: "x", creator: "a" },
		{ id: "y", creator: "b" },
		{ id: "z", creator: "a" },
	])

	t.deepEqual(await db.query("room", { select: { id: true, members: true } }), [
		{ id: "x", members: ["a", "b"] },
		{ id: "y", members: ["b", "c"] },
		{ id: "z", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { select: { id: true, creator: true, members: true } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "y", creator: "b", members: ["b", "c"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])
})

testOnModelDB("query reference values", async (t, openDB) => {
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

	t.deepEqual(await db.query("room", { where: { creator: "a" } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { creator: "b" } }), [{ id: "y", creator: "b", members: ["b", "c"] }])
	t.deepEqual(await db.query("room", { where: { creator: "c" } }), [])
	t.deepEqual(await db.query("room", { where: { creator: { neq: "a" } } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])
})

testOnModelDB("query filtering on relation values", async (t, openDB) => {
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

	t.deepEqual(await db.query("room", { where: { members: ["a"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["b"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["c"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["a", "b"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["b", "a"] } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["b", "c"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["c", "b"] } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["a", "c"] } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["c", "a"] } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: ["a", "b", "c"] } }), [])

	t.deepEqual(await db.query("room", { where: { members: { neq: ["a"] } } }), [
		{ id: "y", creator: "b", members: ["b", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: ["b"] } } }), [
		{ id: "z", creator: "a", members: ["a", "c"] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: ["c"] } } }), [
		{ id: "x", creator: "a", members: ["a", "b"] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: ["a", "b"] } } }), [])
	t.deepEqual(await db.query("room", { where: { members: { neq: ["b", "c"] } } }), [])
	t.deepEqual(await db.query("room", { where: { members: { neq: ["a", "c"] } } }), [])
})
