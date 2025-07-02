import test from "ava"

import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"
import { PRNGSigner } from "./utils.js"

test("create id in host runtime", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "example.xyz"

		static models = {
			blobs: { id: "primary" },
		} satisfies ModelSchema

		async createBlob() {
			const id = this.db.id()
			await this.db.set("blobs", { id })
			return id
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
		signers: [new PRNGSigner(0)],
	})

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.MyApp")

	const { result: result1 } = await app.actions.createBlob()
	const { result: result2 } = await app.actions.createBlob()
	const { result: result3 } = await app.actions.createBlob()
	const { result: result4 } = await app.actions.createBlob()
	const { result: result5 } = await app.actions.createBlob()

	t.deepEqual(await app.db.query("blobs"), [
		{ id: result1 },
		{ id: result2 },
		{ id: result3 },
		{ id: result4 },
		{ id: result5 },
	])

	t.deepEqual(await app.db.query("blobs"), [
		{ id: "d9a997ded77d50620921aa305b4b31a0" },
		{ id: "614d9436b38eea14c672bffe1e44e1e9" },
		{ id: "1ad52196e967e848401dfaf4be8cde78" },
		{ id: "c76c2b331f8551cb9b273855c89cb54f" },
		{ id: "95914be05c6eadd5db6d1353e33bc194" },
	])
})

test("create id in quickjs function", async (t) => {
	const contract = `
	import { Contract } from "@canvas-js/core/contract"

	export default class MyApp extends Contract {
		static topic = "example.xyz"

		static models = {
			blobs: { id: "primary" },
		}

		async createBlob() {
			const id = this.db.id()
			await this.db.set("blobs", { id })
			return id
		}
	}`

	const app = await Canvas.initialize({
		contract: contract,
		signers: [new PRNGSigner(0)],
	})

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.MyApp:f74bc1be4c03e131682a3b5bce1630f7")

	const { result: result1 } = await app.actions.createBlob()
	const { result: result2 } = await app.actions.createBlob()
	const { result: result3 } = await app.actions.createBlob()
	const { result: result4 } = await app.actions.createBlob()
	const { result: result5 } = await app.actions.createBlob()

	t.deepEqual(await app.db.query("blobs"), [
		{ id: result1 },
		{ id: result2 },
		{ id: result3 },
		{ id: result4 },
		{ id: result5 },
	])

	t.deepEqual(await app.db.query("blobs"), [
		{ id: "81043dbdc0188211931e0a9b9e7e3de5" },
		{ id: "b805154007751dd95ba58cbcaf49a51a" },
		{ id: "842df031d2a8a437f564c5bf323dec7c" },
		{ id: "7a34868a461d6f39ae565d8ad284a566" },
		{ id: "ce310fc6d36ad2c093e68d42255ae75c" },
	])
})
