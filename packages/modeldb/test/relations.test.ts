import { nanoid } from "nanoid"

import type { ModelsInit } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

const models: ModelsInit = {
	user: { address: "string" },
	room: {
		creator: "@user",
		members: "@user[]",
	},
}

testOnModelDB("set and get reference and relation values", async (t, openDB) => {
	const db = await openDB(models)

	const [userA, userB] = [nanoid(), nanoid()]
	await db.set("user", userA, { address: "a" })
	await db.set("user", userB, { address: "b" })

	t.is(await db.count("user"), 2)

	const roomId = nanoid()
	await db.set("room", roomId, { creator: userA, members: [userA, userB] })
	t.deepEqual(await db.get("room", roomId), { creator: userA, members: [userA, userB] })
})

testOnModelDB("select reference and relation values", async (t, openDB) => {
	const db = await openDB(models)

	const [userA, userB, userC] = [nanoid(), nanoid(), nanoid()]
	await db.set("user", userA, { address: "a" })
	await db.set("user", userB, { address: "b" })
	await db.set("user", userC, { address: "c" })
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

	const [userA, userB, userC] = [nanoid(), nanoid(), nanoid()]
	await db.set("user", userA, { address: "a" })
	await db.set("user", userB, { address: "b" })
	await db.set("user", userC, { address: "c" })
	await db.set("room", "x", { creator: userA, members: [userA, userB] })
	await db.set("room", "y", { creator: userB, members: [userB, userC] })
	await db.set("room", "z", { creator: userA, members: [userA, userC] })

	t.deepEqual(await db.query("room", { where: { creator: userA } }), [
		{ creator: userA, members: [userA, userB] },
		{ creator: userA, members: [userA, userC] },
	])

	t.deepEqual(await db.query("room", { where: { creator: userB } }), [{ creator: userB, members: [userB, userC] }])
	t.deepEqual(await db.query("room", { where: { creator: userC } }), [])
	t.deepEqual(await db.query("room", { where: { creator: { neq: userA } } }), [
		{ creator: userB, members: [userB, userC] },
	])
})

testOnModelDB("query filtering on relation values", async (t, openDB) => {
	const db = await openDB(models)

	const [userA, userB, userC] = [nanoid(), nanoid(), nanoid()]
	await db.set("user", userA, { address: "a" })
	await db.set("user", userB, { address: "b" })
	await db.set("user", userC, { address: "c" })
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
