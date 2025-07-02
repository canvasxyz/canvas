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
			0.23719689864497184,
			0.6196255471733731,
			0.37230217149501255,
			0.7528334586498452,
			0.8441302381252208,
			0.5403482182954353,
			0.5126781285675837,
		],
	)

	t.teardown(() => app.stop())
	return app
})

test("generate random values inside a string contract", async (t) => {
	const app = await Canvas.initialize({
		contract: `
		export default class MyApp {
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
			0.5539470872333458,
			0.11753915577018713,
			0.8367149418145933,
			0.21810486353818684,
			0.12206275579437226,
			0.2518839060456782,
			0.47960987463138594,
		],
	)

	t.teardown(() => app.stop())
	return app
})
