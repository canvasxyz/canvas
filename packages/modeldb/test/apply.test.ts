import { collect, testOnModelDB } from "./utils.js"

testOnModelDB("apply should roll back partially performed updates if it fails", async (t, openDB) => {
	const db = await openDB({ message: { content: "string" } })

	const error = await t.throwsAsync(() =>
		db.apply({ version: null }, [
			// valid operation
			{ operation: "set", model: "message", key: "foo", value: { content: "test" } },
			// invalid operation
			{ operation: "set", model: "message", key: "bar", value: { content: 1284 } },
		])
	)

	t.is(error?.message, "message/content must be a string")

	// apply should have rolled back after the second operation failed, so the database should be empty
	const messages = await collect(db.iterate("message"))
	t.deepEqual(messages, [])

	t.is(await db.count("message"), 0)
})
