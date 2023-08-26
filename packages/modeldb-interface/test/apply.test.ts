import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

testOnModelDB("apply should roll back partially performed updates if it fails", async (t, modelDBConstructor) => {
	// @ts-ignore
	const models = {
		message: {
			content: "string",
			$type: "immutable",
		},
	} as ModelsInit

	const db = await modelDBConstructor(models)

	const error = await t.throwsAsync(async () => {
		await db.apply(
			[
				// valid operation
				{ operation: "add", model: "message", value: { content: "test" } },
				// invalid operation
				{ operation: "add", model: "message", value: { content: 1284 } },
			],
			{ namespace: "test" }
		)
	})
	t.is(error.message, "message/content must be a string")

	// apply should have rolled back after the second operation failed, so the database should be empty
	const messages = await db.query("message", {})
	t.deepEqual(messages, [])

	t.is(await db.count("message"), 0)
})
