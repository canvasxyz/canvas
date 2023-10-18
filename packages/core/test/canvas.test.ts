import assert from "node:assert"
import crypto from "node:crypto"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"
import { ed25519 } from "@noble/curves/ed25519"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { createSignature } from "@canvas-js/signed-cid"
import { Message } from "@canvas-js/interfaces"

const contract = `
export const models = {
  posts: {
		id: "primary",
    content: "string",
    timestamp: "integer",
  },
};

export const actions = {
  async createPost(db, { content }, { id, chain, address, timestamp }) {
    const postId = [chain, address, id].join("/")
    await db.posts.set({ id: postId, content, timestamp });
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

const init = async (t: ExecutionContext, topic = crypto.randomUUID()) => {
	const app = await Canvas.initialize({ topic, contract, location: null, offline: true })
	t.teardown(() => app.close())
	return app
}

test("open and close an app", async (t) => {
	const app = await init(t)
	t.pass()
})

test("apply an action and read a record from the database", async (t) => {
	const app = await init(t)

	const { id, result: postId } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
})

test("create and delete a post", async (t) => {
	const app = await init(t)

	const { result: postId } = await app.actions.createPost({ content: "hello world" })
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("insert a message created by another app", async (t) => {
	const topic = crypto.randomUUID()
	const [a, b] = await Promise.all([init(t, topic), init(t, topic)])

	const { id } = await a.actions.createPost({ content: "hello world" })
	const [signature, message] = await a.messageLog.get(id)
	assert(signature !== null && message !== null)

	await t.notThrowsAsync(() => b.insert(signature, message))
})

test("reject an invalid message", async (t) => {
	const app = await init(t)

	const privateKey = ed25519.utils.randomPrivateKey()
	const invalidMessage: Message<{ type: "fjdskl" }> = {
		topic: app.topic,
		clock: 1,
		parents: [],
		payload: { type: "fjdskl" },
	}

	const signature = createSignature("ed25519", privateKey, invalidMessage)
	await t.throwsAsync(() => app.insert(signature, invalidMessage as any), {
		message: "error encoding message (invalid payload)",
	})
})

test("create an app with an inline contract", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		topic: "com.example.app",
		location: null,
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
				async createPost(db, args, { id, chain, address, timestamp }) {
					const { content } = args as { content: string }
					const postId = [chain, address, id].join("/")
					await db.posts.set({ id: postId, content, timestamp, address })
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
