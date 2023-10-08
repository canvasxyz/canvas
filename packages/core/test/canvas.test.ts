import assert from "node:assert"
import test from "ava"
import { ethers } from "ethers"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const contract = `
export const models = {
  posts: {
    content: "string",
    timestamp: "integer",
  },
};

export const actions = {
  async createPost(db, { content }, { id, chain, address, timestamp }) {
    const postId = [chain, address, id].join("/")
    await db.posts.set(postId, { content, timestamp });
    return postId
  },

  async deletePost(db, key, { chain, address }) {
		const prefix = [chain, address, ""].join("/")
		if (!key.startsWith(prefix)) {
			throw new Error("unauthorized")
		}

		await db.posts.delete(key)
  },

	async hello() {
		console.log("hello")
	}
};
`.trim()

test("open and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.pass()
})

test("apply an action and read a record from the database", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())

	const { id, result: postId } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
})

test("create and delete a post", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())

	const { result: postId } = await app.actions.createPost({ content: "hello world" })
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("create an app with a function runtime", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		contract: {
			topic: "com.example.app",
			models: {
				posts: {
					content: "string",
					timestamp: "integer",
					address: "string",
				},
			},
			actions: {
				async createPost(db, args, { id, chain, address, timestamp }) {
					const { content } = args as { content: string }
					const postId = [chain, address, id].join("/")
					await db.posts.set(postId, { content, timestamp, address })
					return postId
				},
			},
		},
		offline: true,
		signers: [new SIWESigner({ signer: wallet })],
	})
	t.teardown(() => app.close())

	const { id, result: postId } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is(value?.address, wallet.address)
})
