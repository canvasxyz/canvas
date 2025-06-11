import test from "ava"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema, Contract } from "@canvas-js/core"

import { PRNGSigner } from "./utils.js"

test("initialize contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	class Blog extends Contract<typeof Blog.models> {
		static namespace = "example.xyz"
		static models = {
			posts: { id: "primary", creator: "string", content: "string" },
		} satisfies ModelSchema

		async createPost(content: string) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
	}

	const app = await Blog.initialize()
	app.updateSigners([new SIWESigner({ signer: wallet })])

	t.teardown(() => app.stop())

	t.is(app.namespace, "example.xyz")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

test("initialize string contract with instance topic", async (t) => {
	const contract = `import { Contract } from "@canvas-js/core/contract";

	export default class extends Contract {
	  static namespace = "example.xyz"
		static models = { posts: { id: "primary", creator: "string", content: "string" } }
		async createPost(content) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
	}`

	const app = await Canvas.initialize({
		contract,
		signers: [new PRNGSigner(0)],
	})

	t.teardown(() => app.stop())

	t.is(app.namespace, "example.xyz")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})
