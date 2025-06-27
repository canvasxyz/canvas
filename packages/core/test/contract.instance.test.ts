import test from "ava"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas, ModelSchema, Contract } from "@canvas-js/core"

import { PRNGSigner } from "./utils.js"

test("initialize contract with instance topic", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	class Blog extends Contract<typeof Blog.models> {
		site: string

		static topic = "example.xyz"

		static models = {
			posts: { id: "primary", creator: "string", content: "string" },
		} satisfies ModelSchema

		async createPost(content: string) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}

		constructor(site: string) {
			super(site)
			this.site = site
		}
	}

	const app = await Canvas.initialize({ contract: Blog })
	app.updateSigners([new SIWESigner({ signer: wallet })])

	t.teardown(() => app.stop())

	t.is(app.topic, "example.xyz")
	t.is(app.topic, "example.xyz:76be8b52")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

test("initialize string contract with instance topic", async (t) => {
	const contract = `import { Contract } from "@canvas-js/core/contract";

	export default class extends Contract {
	  static baseTopic = "example.xyz"
		static models = { posts: { id: "primary", creator: "string", content: "string" } }
		async createPost(content) {
			await this.db.create("posts", { id: this.id, creator: this.address, content })
		}
    constructor(site) {
      super(site)
      this.site = site
    }
	}`

	const app = await Canvas.initialize({
		contract,
		signers: [new PRNGSigner(0)],
	})

	t.teardown(() => app.stop())

	t.is(app.baseTopic, "example.xyz")
	t.is(app.topic, "example.xyz:76be8b52")

	await app.actions.createPost("hello world")
	await app.actions.createPost("second post")

	const posts = await app.db.query("posts")
	t.is(posts.length, 2)
})

// test("initialize subclassed contract with instance topic", async (t) => {
// 	const wallet = ethers.Wallet.createRandom()

// 	class Blog extends Contract<typeof Blog.models> {
// 		static models = { posts: { id: "primary", creator: "string", content: "string" } } satisfies ModelSchema
// 		async createPostParent(content: string) {
// 			await this.db.create("posts", { id: this.id, creator: this.address, content })
// 		}
// 	}

// 	class NamespacedBlog extends Blog {
// 		async createPostParent(content: string) {
// 			super.createPostParent(content)
// 		}

// 		async createPostChild(content: string) {
// 			await this.db.create("posts", { id: this.id, creator: this.address, content })
// 		}
// 	}

// 	const app = await NamespacedBlog.initialize("example.xyz")
// 	app.updateSigners([new SIWESigner({ signer: wallet })])

// 	t.teardown(() => app.stop())

// 	t.is(app.topic, "example.xyz")

// 	await app.actions.createPostParent("hello world")
// 	await app.actions.createPostChild("second post")

// 	const posts = await app.db.query("posts")
// 	t.is(posts.length, 2)
// })

// test("initialize subclassed string contract with instance topic", async (t) => {
// 	const contract = `
// 	import { Contract } from "@canvas-js/core/contract";

// 	class Chat extends Contract {
// 		static models = { posts: { id: "primary", creator: "string", content: "string" } }
// 		async createPostParent(content) {
// 			await this.db.create("posts", { id: this.id, creator: this.address, content })
// 		}
//   }

//   export default class extends Chat {
// 		async createPostParent(content) {
// 			super.createPostParent(content)
// 		}
// 		async createPostChild(content) {
// 			await this.db.create("posts", { id: this.id, creator: this.address, content })
// 		}
// 	}`

// 	const app = await Canvas.initialize({
// 		topic: "example.xyz",
// 		contract,
// 	})

// 	t.teardown(() => app.stop())

// 	t.is(app.topic, "example.xyz")

// 	await app.actions.createPostParent("hello world")
// 	await app.actions.createPostChild("second post")

// 	const posts = await app.db.query("posts")
// 	t.is(posts.length, 2)
// })
