import test from "ava"

import { Canvas } from "@canvas-js/core"
import { PRNGSigner } from "./PRNGSigner.js"
import { setTimeout } from "timers/promises"

test("test PRNGSigner", async (t) => {
	const app1 = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {},
			actions: { hello: () => {} },
		},
		signers: [new PRNGSigner(0)],
	})

	const app2 = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {},
			actions: { hello: () => {} },
		},
		signers: [new PRNGSigner(0)],
	})

	for (let i = 0; i < 3; i++) {
		await app1.actions.hello()
		await setTimeout(10)
		await app2.actions.hello()
		await setTimeout(10)
	}

	t.deepEqual(await app1.db.query("$messages"), await app2.db.query("$messages"))
})
