import type { Context, ModelValue, ModelsInit } from "@canvas-js/modeldb"

import { testOnModelDB, v } from "./utils.js"

const models: ModelsInit = {
	user: { address: "string" },
	room: {
		creator: "@user",
		members: "@user[]",
	},
}

testOnModelDB("subscriptions", async (t, openDB) => {
	const db = await openDB(models)

	const changes: { results: ModelValue[]; context: Context | null }[] = []
	const id = await db.subscribe("user", {}, (results, context) => void changes.push({ results, context }))
	t.teardown(() => db.unsubscribe(id))

	await db.add("user", { address: "a" })
	await db.add("user", { address: "b" })

	t.is(await db.count("user"), 2)
	t.deepEqual(changes, [
		{ results: [], context: null },
		{ results: [{ address: "a" }], context: { version: null } },
		{ results: [{ address: "a" }, { address: "b" }], context: { version: null } },
	])
})

testOnModelDB("subscriptions (filtering on model and query)", async (t, openDB) => {
	const db = await openDB(models)

	let revision = 0
	const c = () => ({ version: v(revision++) })

	const userA = await db.add("user", { address: "a" }, c())
	const userB = await db.add("user", { address: "b" }, c())
	const userC = await db.add("user", { address: "c" }, c())

	const changes: { results: ModelValue[]; context: Context | null }[] = []
	const id = await db.subscribe(
		"room",
		{ where: { creator: userA } },
		(results, context) => void changes.push({ results, context })
	)

	t.teardown(() => db.unsubscribe(id))

	await db.set("room", "x", { creator: userA, members: [userA, userB] }, c())
	await db.set("room", "y", { creator: userB, members: [userB, userC] }, c())
	await db.set("room", "z", { creator: userA, members: [userA, userC] }, c())
	await db.add("user", { address: "d" }, c())
	await db.add("user", { address: "e" }, c())

	t.deepEqual(changes, [
		{ results: [], context: null },
		{ results: [{ creator: userA, members: [userA, userB] }], context: { version: v(3) } },
		{
			results: [
				{ creator: userA, members: [userA, userB] },
				{ creator: userA, members: [userA, userC] },
			],
			context: { version: v(5) },
		},
	])
})
