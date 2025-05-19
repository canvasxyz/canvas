import test, { ExecutionContext } from "ava"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Canvas } from "@canvas-js/core/sync"

const contract = `
export const models = {
  posts: {
    id: "primary",
    content: "string",
    address: "string",
    did: "string",
    timestamp: "integer",
    isVisible: "boolean",
    metadata: "json"
  },
};

export const actions = {
  async createPost(content, isVisible, metadata) {
    const { id, did, address, timestamp, db } = this
    const postId = [did, id].join("/")
    await db.transaction(() => db.set("posts", { id: postId, content, address, did, isVisible, timestamp, metadata }));
  },

  async updatePost(postId, content, isVisible, metadata) {
    const { id, did, address, timestamp, db } = this
    const post = await db.get("posts", postId)
    if (post.did !== did) throw new Error("can only update own posts")
    await db.transaction(() => db.update("posts", { id: postId, content, isVisible, metadata }));
  },

  async deletePost(key) {
    const { did, db } = this
    if (!key.startsWith(did + "/")) {
      throw new Error("unauthorized")
    }

    await db.delete("posts", key)
  },
};
`.trim()

const init = (t: ExecutionContext) => {
	const signer = new SIWESigner({ burner: true })
	const app = new Canvas({
		contract,
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})

	t.teardown(async () => {
		await app.initPromise
		await app.stop()
	})
	return { app, signer }
}

test("with sync initializer, apply an action and read a record from the database", async (t) => {
	const { app } = init(t)

	const { id, message } = await app.actions.createPost("hello", true, {})

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")
})

test("with sync initializer, create and delete a post", async (t) => {
	const { app } = init(t)

	const { id, message } = await app.actions.createPost("hello world", true, { author: "me" })

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is((value?.metadata as any).author, "me")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("with sync initializer, create and delete a post using an inline contract", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const app = new Canvas({
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
					timestamp: "integer",
					address: "string",
				},
			},
			actions: {
				async createPost({ content }: { content: string }) {
					const { id, did, timestamp, db, address } = this
					const postId = [did, id].join("/")
					await db.set("posts", { id: postId, content, timestamp, address })
					return content
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
	})

	t.teardown(async () => {
		await app.initPromise
		await app.stop()
	})

	const { id, message } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)

	t.is(value?.content, "hello world", "content matches")
	t.is(value?.address, wallet.address, "address matches")
})
