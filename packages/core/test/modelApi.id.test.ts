import test from "ava"

import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"
import { PRNGSigner } from "./utils.js"

test("create id in host runtime", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
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
		topic: "example.xyz",
		contract: MyApp,
		signers: [new PRNGSigner(0)],
	})

	t.teardown(() => app.stop())

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
		{ id: "b1c1b65427bf8349b70cbf29ffda5c56" },
		{ id: "be909ae8ade0d53f5b4c89208ac4ae9e" },
		{ id: "32054f3ecc85dcaa5f63abc500c36bf1" },
		{ id: "dff7e4ecf59dda4ef2db032de8c1675c" },
		{ id: "37f8d99dce9234cf8173b44dcdad7d35" },
	])
})

test("create id in quickjs function", async (t) => {
	const contract = `
	import { Contract } from "@canvas-js/core/contract"

  export default class MyApp extends Contract {
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
		topic: "example.xyz",
		contract: contract,
		signers: [new PRNGSigner(0)],
	})

	t.is(app.topic, "example.xyz")

	t.teardown(() => app.stop())

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
		{ id: "b1c1b65427bf8349b70cbf29ffda5c56" },
		{ id: "be909ae8ade0d53f5b4c89208ac4ae9e" },
		{ id: "32054f3ecc85dcaa5f63abc500c36bf1" },
		{ id: "dff7e4ecf59dda4ef2db032de8c1675c" },
		{ id: "37f8d99dce9234cf8173b44dcdad7d35" },
	])
})
