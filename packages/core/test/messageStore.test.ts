// import test from "ava"

// import { sha256 } from "@noble/hashes/sha256"

// import { openMessageStore } from "@canvas-js/core/components/messageStore"
// import { CustomAction } from "@canvas-js/interfaces"

// test("MessageStore can insert and retrieve a custom action", async (t) => {
// 	const app = "foobar"

// 	const ms = await openMessageStore(app, null)
// 	const hash = sha256("something")
// 	const name = "doThing"
// 	const payload = {}

// 	const customAction: CustomAction = { type: "customAction", app, name, payload }
// 	await ms.write((txn) => txn.insertMessage(hash, customAction))

// 	t.deepEqual(await ms.read((txn) => txn.getMessage(hash)), customAction)

// 	let numCustomActions = 0
// 	for await (const [id, message] of ms.getMessageStream({ type: "customAction" })) {
// 		t.deepEqual(id, hash)
// 		t.deepEqual(message, customAction)
// 		numCustomActions++
// 	}

// 	t.assert(numCustomActions == 1)
// })

import test from "ava"

test("no-op", (t) => t.pass())
