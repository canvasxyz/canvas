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
export const topic = "com.example.app"

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

const init = async (t: ExecutionContext) => {
	const app = await Canvas.initialize({ path: null, contract, offline: true })
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
	const [a, b] = await Promise.all([init(t), init(t)])

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
		path: null,
		contract: {
			topic: "com.example.app",
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

test("get a value set by another action", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		path: null,
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			topic: "com.example.app",
			models: {
				user: { id: "primary", name: "string" },
				post: { id: "primary", from: "@user", content: "string" },
			},
			actions: {
				async createUser(db, { name }: { name: string }, { chain, address }) {
					await db.user.set({ id: `${chain}:${address}`, name })
				},
				async createPost(db, { content }: { content: string }, { id, chain, address }) {
					const from = `${chain}:${address}`
					const user = await db.user.get(from)
					assert(user !== null)
					await db.post.set({ id, from, content })
				},
				async deletePost(db, { id }: { id: string }, { chain, address }) {
					const post = await db.post.get(id)
					if (post !== null) {
						assert(post.from === `${chain}:${address}`, "cannot delete others' posts")
						await db.post.delete(id)
					}
				},
			},
		},
		offline: true,
	})

	t.teardown(() => app.close())

	const { id } = await app.actions.createUser({ name: "John Doe" })
	t.log(`${id}: created user`)
	const { id: a } = await app.actions.createPost({ content: "foo" })
	t.log(`${a}: created post`)
	const { id: b } = await app.actions.createPost({ content: "bar" })
	t.log(`${b}: created post`)

	const compareIDs = ({ id: a }: { id: string }, { id: b }: { id: string }) => (a < b ? -1 : a === b ? 0 : 1)

	t.deepEqual(
		await app.db
			.query<{ id: string; from: string; content: string }>("post", {})
			.then((results) => results.sort(compareIDs)),
		[
			{ id: a, from: `eip155:1:${wallet.address}`, content: "foo" },
			{ id: b, from: `eip155:1:${wallet.address}`, content: "bar" },
		].sort(compareIDs)
	)
})

test("validate action args using IPLD schemas", async (t) => {
	const schema = `
		type CreatePostPayload struct {
			content String
			inReplyTo nullable String
		} representation tuple
	`

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		path: null,
		contract: {
			topic: "com.example.app",
			models: {
				posts: {
					id: "primary",
					content: "string",
					timestamp: "integer",
					address: "string",
				},
			},
			actions: {
				createPost: {
					argsType: { schema, name: "CreatePostPayload" },
					apply: async (
						db,
						{ content, inReplyTo }: { content: string; inReplyTo: string | null },
						{ id, chain, address, timestamp }
					) => {
						const postId = [chain, address, id].join("/")
						await db.posts.set({ id: postId, content, timestamp, address })
						return postId
					},
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
		offline: true,
	})

	t.teardown(() => app.close())

	const { id } = await app.actions.createPost({ content: "hello world!", inReplyTo: null })

	// validate that the args are represented as tuples inside the action
	const [_, message] = await app.getMessage(id)
	assert(message !== null && message.payload.type === "action")
	t.deepEqual(message.payload.args, ["hello world!", null])

	await t.throwsAsync(() => app.actions.createPost({ content: 8 } as any), {
		message: "action args did not validate the provided schema type",
	})

	t.is(await app.db.count("posts"), 1)
})
