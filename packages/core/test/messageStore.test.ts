import test from "ava"

import { MessageStore } from "@canvas-js/core"

test("MessageStore can insert and retrieve a custom action", async (t) => {
	const app = "foobar"

	const ms = new MessageStore(app, null)
	const hash = Buffer.from("something")
	const name = "doThing"
	const payload = {}

	ms.insert(hash, {
		type: "customAction",
		app,
		name,
		payload,
	})

	const retrievedCustomAction = ms.getCustomActionByHash(hash)
	if (retrievedCustomAction) {
		t.assert(retrievedCustomAction.app == app)
		t.assert(retrievedCustomAction.name == name)
		t.deepEqual(retrievedCustomAction.payload, payload)
	} else {
		t.fail(`custom action with hash ${hash} not retrieved`)
	}

	const retrievedActions = ms.getCustomActionStream()
	let numCustomActions = 0
	for (const [retrievedHash, retrievedCustomAction_] of retrievedActions) {
		t.deepEqual(retrievedHash, hash)
		t.deepEqual(retrievedCustomAction_.app, app)
		t.deepEqual(retrievedCustomAction_.name, name)
		t.deepEqual(retrievedCustomAction_.payload, payload)
		numCustomActions++
	}
	t.assert(numCustomActions == 1)
})
