import assert from "node:assert"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"

import type { Message } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signatures"
import { SIWESigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

const contract = `
export const topic = "com.example.app"

export const models = {
  posts: {
    id: "primary",
    content: "string",
    timestamp: "integer",
    isVisible: "boolean",
		metadata: "json"
  },
};

export const actions = {
  async createPost(db, { content, isVisible, metadata }, { id, address, timestamp }) {
    const postId = [address, id].join("/")
    await db.set("posts", { id: postId, content, isVisible, timestamp, metadata });
    return postId
  },

  async deletePost(db, key, { address }) {
		if (!key.startsWith(address + "/")) {
			throw new Error("unauthorized")
		}

		await db.delete("posts", key)
  },

	async hello() {
		console.log("hello")
	}
};
`.trim()

const init = async (t: ExecutionContext) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	return app
}

const initEIP712 = async (t: ExecutionContext) => {
	const app = await Canvas.initialize({ contract, offline: true, signers: [new Eip712Signer()] })
	t.teardown(() => app.close())
	return app
}

test("open and close an app", async (t) => {
	const app = await init(t)
	t.pass()
})

test("apply an action and read a record from the database", async (t) => {
	const app = await init(t)

	const { id, result: postId } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		something: null,
		metadata: {},
	})

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
})

test("create and delete a post", async (t) => {
	const app = await init(t)

	const { result: postId } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		metadata: { author: "me" },
	})
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	// TODO: better type inference for the result of db.get
	t.is((value?.metadata as any).author, "me")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("insert a message created by another app", async (t) => {
	const [a, b] = await Promise.all([init(t), init(t)])

	const { id } = await a.actions.createPost({ content: "hello world", isVisible: true, something: "bar", metadata: {} })
	const [signature, message] = await a.messageLog.get(id)
	assert(signature !== null && message !== null)

	await t.notThrowsAsync(() => b.insert(signature, message))
})

test("reject an invalid message", async (t) => {
	const app = await init(t)

	const signer = new Ed25519Signer()
	const invalidMessage: Message<{ type: "fjdskl" }> = {
		topic: app.topic,
		clock: 1,
		parents: [],
		payload: { type: "fjdskl" },
	}

	const signature = signer.sign(invalidMessage)
	await t.throwsAsync(() => app.insert(signature, invalidMessage as any), {
		message: "error encoding message (invalid payload)",
	})
})

test("create an app with an inline contract", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
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
				async createPost(db, args, { id, address, timestamp }) {
					const { content } = args as { content: string }
					const postId = [address, id].join("/")
					await db.set("posts", { id: postId, content, timestamp, address })
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
	t.is(value?.address, `eip155:1:${wallet.address}`)
})

test("get a value set by another action", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			topic: "com.example.app",
			models: {
				user: { id: "primary", name: "string" },
				post: { id: "primary", from: "@user", content: "string" },
			},
			actions: {
				async createUser(db, { name }: { name: string }, { address }) {
					await db.set("user", { id: address, name })
				},
				async createPost(db, { content }: { content: string }, { id, address }) {
					const user = await db.get("user", address)
					assert(user !== null)
					await db.set("post", { id, from: address, content })
				},
				async deletePost(db, { id }: { id: string }, { address }) {
					const post = await db.get("post", id)
					if (post !== null) {
						assert(post.from === address, "cannot delete others' posts")
						await db.delete("post", id)
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
		].sort(compareIDs),
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
					requireSessionAuthentication: false,
					argsType: { schema, name: "CreatePostPayload" },
					apply: async (
						db,
						{ content, inReplyTo }: { content: string; inReplyTo: string | null },
						{ id, address, timestamp },
					) => {
						const postId = [address, id].join("/")
						await db.set("posts", { id: postId, content, timestamp, address })
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

test("apply an action and read a record from the database using eip712", async (t) => {
	const app = await initEIP712(t)

	const { id, result: postId } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		something: -1,
		metadata: 0,
	})

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	const { id: id2, result: postId2 } = await app.actions.createPost({
		content: "foo bar",
		isVisible: true,
		something: -1,
		metadata: 0,
	})

	t.log(`applied action ${id2} and got result`, postId)
	assert(typeof postId2 === "string")
	const value2 = await app.db.get("posts", postId2)
	t.is(value2?.content, "foo bar")
})
