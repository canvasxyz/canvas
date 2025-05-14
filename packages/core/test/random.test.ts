import test from "ava"

import { Canvas } from "@canvas-js/core"

import { PRNGSigner } from "./utils.js"

test("generate random values inside a contract", async (t) => {
	const app = await Canvas.initialize({
		contract: {
			models: {},
			actions: {
				async getRandom() {
					const { db } = this
					return db.random()
				},
			},
		},
		topic: "com.example.app",
		signers: [new PRNGSigner(0)],
	})

	const values = [
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
	]

	t.deepEqual(
		values,
		[
			0.6264584624735775, 0.37087792841970874, 0.7210393801147675, 0.017600891417265146, 0.268673552029923,
			0.5984088300257941, 0.629442668433637,
		],
	)

	t.teardown(() => app.stop())
	return app
})

test("generate random values inside a string contract", async (t) => {
	const app = await Canvas.initialize({
		contract: `export const models = {};
export const actions = {
	async getRandom() {
		const { db } = this
		return db.random()
	},
};`,
		topic: "com.example.app",
		signers: [new PRNGSigner(0)],
	})

	const values = [
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
		(await app.actions.getRandom()).result,
	]

	t.deepEqual(
		values,
		[
			0.6264584624735775, 0.37087792841970874, 0.7210393801147675, 0.017600891417265146, 0.268673552029923,
			0.5984088300257941, 0.629442668433637,
		],
	)

	t.teardown(() => app.stop())
	return app
})
