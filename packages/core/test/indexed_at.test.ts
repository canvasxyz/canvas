import test from "ava"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

test("$indexed_at should not be accessible from inside a contract", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
				},
			},
			actions: {
				createPost: async (db, { content }, { id }) => {
					await db.set("posts", { id, content })
				},
				checkIndexedAt: async (db, { id }) => {
					const post = await db.get("posts", id)
					if (!post) {
						throw new Error("Post not found")
					}

					if ((post as any)["$indexed_at"]) {
						throw new Error("indexed_at should not be accessible from inside a contract")
					}
				},
			},
		},
		signers: [new SIWESigner()],
	})

	t.teardown(() => app.stop())

	const message = await app.actions.createPost({ content: "Hello, World!" })

	await app.actions.checkIndexedAt({ id: message.id })
	t.pass()
})

test("$indexed_at should be accessible from outside a contract", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
				},
			},
			actions: {
				createPost: async (db, { content }, { id }) => {
					await db.set("posts", { id, content })
				},
				checkIndexedAt: async (db, { id }) => {
					const post = await db.get("posts", id)
					if (!post) {
						throw new Error("Post not found")
					}

					if ((post as any)["$indexed_at"]) {
						throw new Error("indexed_at should not be accessible from inside a contract")
					}
				},
			},
		},
		signers: [new SIWESigner()],
	})

	t.teardown(() => app.stop())

	const message = await app.actions.createPost({ content: "Hello, World!" })

	const postFromDb = await app.db.get("posts", message.id)
	if (!postFromDb) {
		throw new Error("Post not found")
	}
	t.truthy(postFromDb["$indexed_at"])
})
