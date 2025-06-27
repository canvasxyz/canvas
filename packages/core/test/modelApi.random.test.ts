import test from "ava"

import { Canvas } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

import { PRNGSigner } from "./utils.js"

test("generate random values inside a contract", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"
		static models = {}

		async getRandom() {
			return this.db.random()
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
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
      static topic = "com.example.app"
  		static models = {}
     	async getRandom() {
        return this.db.random()
     	}
    }`,
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
