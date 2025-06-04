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
  export default class MyApp {
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
		{ id: "107e0537ec7b845b2bb1f5d9335e09ee" },
		{ id: "d6fff063ed0ebb46bcc5e8812201ff94" },
		{ id: "fce2b44c8df0394f876030814df64a0a" },
		{ id: "67c5e2f87715c6cd28ef9c5ce2662a8c" },
		{ id: "0d95a27e137b06f7ebcf3482b9461fa5" },
	])
})
