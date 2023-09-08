import { ModelsInit } from "@canvas-js/modeldb-interface"

import { testOnModelDB } from "./utils.js"

const models: ModelsInit = {
	user: { address: "string" },

	room: {
		creator: "@user",
		members: "@user[]",
	},

	message: {
		room: "@room",
		sender: "@user",
		content: "string",
		timestamp: "integer",
	},
}

testOnModelDB("set and get reference and relation values", async (t, openDB) => {
	const db = await openDB(models)

	const userA = await db.add("user", { address: "a" })
	const userB = await db.add("user", { address: "b" })

	t.is(await db.count("user"), 2)

	const roomId = await db.add("room", { creator: userA, members: [userA, userB] })
	t.deepEqual(await db.get("room", roomId), { creator: userA, members: [userA, userB] })
})

testOnModelDB("select reference and relation values", async (t, openDB) => {
	const db = await openDB(models)

	const userA = await db.add("user", { address: "a" })
	const userB = await db.add("user", { address: "b" })
	const userC = await db.add("user", { address: "c" })
	await db.set("room", "x", { creator: userA, members: [userA, userB] })
	await db.set("room", "y", { creator: userB, members: [userB, userC] })
	await db.set("room", "z", { creator: userA, members: [userA, userC] })

	t.deepEqual(await db.query("room", { select: { creator: true } }), [
		{ creator: userA },
		{ creator: userB },
		{ creator: userA },
	])

	t.deepEqual(await db.query("room", { select: { members: true } }), [
		{ members: [userA, userB] },
		{ members: [userB, userC] },
		{ members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { select: { creator: true, members: true } }), [
		{ creator: userA, members: [userA, userB] },
		{ creator: userB, members: [userB, userC] },
		{ creator: userA, members: [userA, userC] },
	])
})

testOnModelDB("query reference values", async (t, openDB) => {
	const db = await openDB(models)

	const userA = await db.add("user", { address: "a" })
	const userB = await db.add("user", { address: "b" })
	const userC = await db.add("user", { address: "c" })
	await db.set("room", "x", { creator: userA, members: [userA, userB] })
	await db.set("room", "y", { creator: userB, members: [userB, userC] })
	await db.set("room", "z", { creator: userA, members: [userA, userC] })

	t.deepEqual(await db.query("room", { where: { creator: userA } }), [
		{ creator: userA, members: [userA, userB] },
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { creator: userB } }), [{ creator: userB, members: [userB, userC] }])
	t.deepEqual(await db.query("room", { where: { creator: userC } }), [])
})

testOnModelDB("query filtering on relation values", async (t, openDB) => {
	const db = await openDB(models)

	const userA = await db.add("user", { address: "a" })
	const userB = await db.add("user", { address: "b" })
	const userC = await db.add("user", { address: "c" })
	await db.set("room", "x", { creator: userA, members: [userA, userB] })
	await db.set("room", "y", { creator: userB, members: [userB, userC] })
	await db.set("room", "z", { creator: userA, members: [userA, userC] })

	t.deepEqual(await db.query("room", { where: { members: [userA] } }), [
		{ creator: userA, members: [userA, userB] },
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userB] } }), [
		{ creator: userA, members: [userA, userB] },
		{ creator: userB, members: [userB, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userC] } }), [
		{ creator: userB, members: [userB, userC] },
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userA, userB] } }), [
		{ creator: userA, members: [userA, userB] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userB, userA] } }), [
		{ creator: userA, members: [userA, userB] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userB, userC] } }), [
		{ creator: userB, members: [userB, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userC, userB] } }), [
		{ creator: userB, members: [userB, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userA, userC] } }), [
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userC, userA] } }), [
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: [userA, userB, userC] } }), [])

	t.deepEqual(await db.query("room", { where: { members: { neq: [userA] } } }), [
		{ creator: userB, members: [userB, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: [userB] } } }), [
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: [userC] } } }), [
		{ creator: userA, members: [userA, userB] },
	])

	t.deepEqual(await db.query("room", { where: { members: { neq: [userA, userB] } } }), [])
	t.deepEqual(await db.query("room", { where: { members: { neq: [userB, userC] } } }), [])
	t.deepEqual(await db.query("room", { where: { members: { neq: [userA, userC] } } }), [])
})
