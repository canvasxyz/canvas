import test from "ava"

import { MessageStore } from "@canvas-js/core/components/messageStore"
import { CustomAction } from "@canvas-js/interfaces"

test("MessageStore can insert and retrieve a custom action", async (t) => {
	const app = "foobar"

	const ms = await MessageStore.initialize(app, null)
	const hash = Buffer.from("something")
	const name = "doThing"
	const payload = {}

	const customAction: CustomAction = { type: "customAction", app, name, payload }
	await ms.write((txn) => txn.insertMessage(hash, customAction))

	t.deepEqual(await ms.getCustomActionByHash(hash), customAction)

	let numCustomActions = 0
	for await (const [id, message] of ms.getMessageStream({ type: "customAction" })) {
		t.deepEqual(id, hash)
		t.deepEqual(message, customAction)
		numCustomActions++
	}

	t.assert(numCustomActions == 1)
})
