import test from "ava"

import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"
import { PRNGSigner } from "./utils.js"
import { setTimeout } from "timers/promises"

test("test PRNGSigner", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"
		static models = {} satisfies ModelSchema

		async hello() {}
	}

	const app1 = await Canvas.initialize({
		contract: MyApp,
		signers: [new PRNGSigner(0)],
	})

	const app2 = await Canvas.initialize({
		contract: MyApp,
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
