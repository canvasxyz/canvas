import { collect, testOnModelDB } from "./utils.js"

testOnModelDB("apply should roll back partially performed updates if it fails", async (t, openDB) => {
	const db = await openDB({ message: { id: "primary", content: "string" } })

	await t.throwsAsync(
		() =>
			db.apply([
				// valid operation
				{ operation: "set", model: "message", value: { id: "a", content: "test" } },
				// invalid operation
				{ operation: "set", model: "message", value: { id: "b", content: 1284 } },
			]),
		{ message: "message/content must be a string" }
	)

	// apply should have rolled back after the second operation failed, so the database should be empty
	const messages = await collect(db.iterate("message"))
	t.deepEqual(messages, [])

	t.is(await db.count("message"), 0)
})
