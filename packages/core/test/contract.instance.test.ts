import test from "ava"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema, Contract, GetActionsType } from "@canvas-js/core"

test("initialize contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	class Blog extends Contract<typeof Blog.models> {
		static models = { posts: { id: "primary", creator: "string", content: "string" } } satisfies ModelSchema
		async createPost(content: string) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
		constructor(topic: string) {
			super(topic + ".test")
		}
	}

	const app = await Blog.initialize("example.xyz")
	app.updateSigners([new SIWESigner({ signer: wallet })])

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.test")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

test("initialize string contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const contract = `import { Contract } from "@canvas-js/core/contract";

	export default class extends Contract {
		static models = { posts: { id: "primary", creator: "string", content: "string" } }
		async createPost(content) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
		constructor(topic) {
			super(topic + ".test")
		}
	}`

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract,
	})

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.test")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

test("initialize subclassed contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	class Blog extends Contract<typeof Blog.models> {
		static models = { posts: { id: "primary", creator: "string", content: "string" } } satisfies ModelSchema
		async createPostParent(content: string) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
	}

	class NamespacedBlog extends Blog {
		async createPostParent(content: string) {
			super.createPostParent(content)
		}
		async createPostChild(content: string) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
		constructor(topic: string) {
			super(topic + ".test")
		}
	}

	const app = await NamespacedBlog.initialize("example.xyz")
	app.updateSigners([new SIWESigner({ signer: wallet })])

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.test")

	await app.actions.createPostParent("hello world")
	await app.actions.createPostChild("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

test("initialize subclassed string contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const contract = `import { Contract } from "@canvas-js/core/contract";

	class Chat extends Contract {
		static models = { posts: { id: "primary", creator: "string", content: "string" } }
		async createPostParent(content) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
  }
  export default class extends Chat {
		async createPostParent(content) {
			super.createPostParent(content)
		}
		async createPostChild(content) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
		constructor(topic) {
			super(topic + ".test")
		}
	}`

	const app = await Canvas.initialize({
		topic: "example.xyz",
		contract,
	})

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz.test")

	await app.actions.createPostParent("hello world")
	await app.actions.createPostChild("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})
