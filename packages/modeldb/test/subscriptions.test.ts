import type { ModelValue, ModelSchema } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

const models: ModelSchema = {
	user: { address: "primary" },
	room: {
		id: "primary",
		creator: "@user",
		members: "@user[]",
	},
}

testOnModelDB("subscriptions", async (t, openDB) => {
	const db = await openDB(t, models)

	const changes: { results: ModelValue[] }[] = []
	const { id, results } = db.subscribe("user", {}, (results) => {
		changes.push({ results })
	})

	t.teardown(() => db.unsubscribe(id))
	await results
	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })

	t.is(await db.count("user"), 2)
	t.deepEqual(changes, [
		{ results: [] },
		{ results: [{ address: "a" }] },
		{ results: [{ address: "a" }, { address: "b" }] },
	])
})

testOnModelDB("subscriptions (filtering on model and query)", async (t, openDB) => {
	const db = await openDB(t, models)

	await db.set("user", { address: "a" })
	await db.set("user", { address: "b" })
	await db.set("user", { address: "c" })

	const changes: { results: ModelValue[] }[] = []
	const { id, results } = db.subscribe("room", { where: { creator: "a" } }, (results) => {
		changes.push({ results })
	})

	t.teardown(() => db.unsubscribe(id))

	await results

	await db.set("room", { id: "x", creator: "a", members: ["a", "b"] })
	await db.set("room", { id: "y", creator: "b", members: ["b", "c"] })
	await db.set("room", { id: "z", creator: "a", members: ["a", "c"] })
	await db.set("user", { address: "d" })
	await db.set("user", { address: "e" })

	t.deepEqual(changes, [
		{ results: [] },
		{ results: [{ id: "x", creator: "a", members: ["a", "b"] }] },
		{
			results: [
				{ id: "x", creator: "a", members: ["a", "b"] },
				{ id: "z", creator: "a", members: ["a", "c"] },
			],
		},
	])
})
