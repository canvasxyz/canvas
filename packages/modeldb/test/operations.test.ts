import { nanoid } from "nanoid"

import { testOnModelDB } from "./utils.js"

testOnModelDB("update a value", async (t, openDB) => {
	const db = await openDB({
		user: { id: "primary", name: "string" },
	})

	const id = nanoid()

	await db.set("user", { id, name: "John" })
	await db.set("user", { id, name: "John Doe" })
	t.deepEqual(await db.get("user", id), { id, name: "John Doe" })
})

testOnModelDB("delete a value ", async (t, openDB) => {
	const db = await openDB({
		user: { id: "primary", name: "string" },
	})

	const id = nanoid()

	await db.set("user", { id, name: "John" })
	t.is(await db.count("user"), 1)

	await db.delete("user", id)
	t.is(await db.get("user", id), null)
	t.is(await db.count("user"), 0)
})
