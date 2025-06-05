import test from "ava"

import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

import { PRNGSigner } from "./utils.js"

test("generate random values inside a contract", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {}

		async getRandom() {
			const { db } = this
			return db.random()
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
		topic: "com.example.app",
		signers: [new PRNGSigner(0)],
	})

	const values: number[] = []
	for (let i = 0; i < 7; i++) {
		const { result: value } = await app.actions.getRandom()
		values.push(value)
	}

	t.deepEqual(
		values,

		// prettier-ignore
		[
     0.24929093804506638,
     0.6215243012711583,
     0.5763528717034423,
     0.9327002352383666,
     0.18960461161623013,
     0.8496135401239201,
     0.6661398817024785,
		],
	)

	t.teardown(() => app.stop())
	return app
})

test("generate random values inside a string contract", async (t) => {
	const app = await Canvas.initialize({
		contract: `
		export default class {
  		static models = {}
     	async getRandom() {
        const { db } = this
        return db.random()
     	}
    }`,
		topic: "com.example.app",
		signers: [new PRNGSigner(0)],
	})

	const values: number[] = []
	for (let i = 0; i < 7; i++) {
		const { result: value } = await app.actions.getRandom()
		values.push(value)
	}

	t.deepEqual(
		values,

		// prettier-ignore
		[
     0.9838228275857743,
     0.07798868040690073,
     0.5636992488524546,
     0.516090551611387,
     0.840555064894073,
     0.9461054920030187,
     0.5357997354493413,
		],
	)

	t.teardown(() => app.stop())
	return app
})
