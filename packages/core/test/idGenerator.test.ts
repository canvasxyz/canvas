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

	const { result } = await app.actions.createBlob()
	t.deepEqual(await app.db.query("blobs"), [{ id: result }])
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

	const { result } = await app.actions.createBlob()
	t.deepEqual(await app.db.query("blobs"), [{ id: result }])
})
