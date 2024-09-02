import assert from "node:assert"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"
import pg from "pg"

import type { Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { SIWESigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { Canvas } from "@canvas-js/core"

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
  async createPost(db, { content, isVisible, metadata }, { id, did, address, timestamp }) {
    const postId = [did, id].join("/")
    await db.set("posts", { id: postId, content, address, did, isVisible, timestamp, metadata });
  },

  async deletePost(db, key, { did }) {
		if (!key.startsWith(did + "/")) {
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
	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		contract,
		topic: "com.example.app",
		start: false,
		reset: true,
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return { app, signer }
}

const initEIP712 = async (t: ExecutionContext) => {
	const signer = new Eip712Signer()
	const app = await Canvas.initialize({
		contract,
		topic: "com.example.app",
		start: false,
		reset: true,
		signers: [signer],
	})
	t.teardown(() => app.stop())
	return { app, signer }
}

test("apply an action and read a record from the database", async (t) => {
	const { app } = await init(t)

	const { id, message } = await app.actions.createPost({
		content: "hello",
		isVisible: true,
		something: null,
		metadata: {},
	})

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const clock = await app.messageLog.getClock()
	t.is(clock[0], 3)

	const { id: id2 } = await app.actions.createPost({
		content: "bumping this thread again",
		isVisible: true,
		something: null,
		metadata: {},
	})
	t.log(`applied action ${id2}`)
	const clock2 = await app.messageLog.getClock()
	t.is(clock2[0], 4)
})

test("create and delete a post", async (t) => {
	const { app } = await init(t)

	const { id, message } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		metadata: { author: "me" },
	})

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	// TODO: better type inference for the result of db.get
	t.is((value?.metadata as any).author, "me")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("insert a message created by another app", async (t) => {
	const [{ app: a }, { app: b }] = await Promise.all([init(t), init(t)])

	await a.actions.createPost({ content: "hello world", isVisible: true, something: "bar", metadata: {} })
	const records = await a.messageLog.getMessages()
	for (const { signature, message } of records) {
		await t.notThrowsAsync(() => b.insert(signature, message))
	}
})

test("insert a message into an app with multiple signers", async (t) => {
	const siweSigner = new SIWESigner()
	const eipSigner = new Eip712Signer()
	const cosmosSigner = new CosmosSigner()

	const getApp = async () => {
		const app = await Canvas.initialize({
			topic: "test",
			contract: {
				models: {},
				actions: { createPost() {} },
			},
			start: false,
			reset: true,
			signers: [siweSigner, cosmosSigner],
		})
		t.teardown(() => app.stop())
		return app
	}
	const a = await getApp()
	const b = await getApp()

	await a.actions.createPost({ content: "hello siwe" }, { signer: siweSigner })
	await a.actions.createPost({ content: "hello cosmos" }, { signer: cosmosSigner })
	await t.throwsAsync(() => a.actions.createPost({ content: "hello eip712" }, { signer: eipSigner }))

	const records = await a.messageLog.getMessages()
	t.is(records.length, 4)
	t.is(records[0].signature.codec, "dag-cbor")
	t.is(records[1].signature.codec, "dag-cbor")
	t.is(records[2].signature.codec, "dag-cbor")
	t.is(records[3].signature.codec, "dag-cbor")

	for (const { signature, message } of records) {
		await t.notThrowsAsync(() => b.insert(signature, message))
	}
})

test("reject an invalid message", async (t) => {
	const { app } = await init(t)

	const scheme = ed25519.create()
	const invalidMessage: Message<{ type: "fjdskl" }> = {
		topic: app.topic,
		clock: 1,
		parents: [],
		payload: { type: "fjdskl" },
	}

	const signature = scheme.sign(invalidMessage)
	await t.throwsAsync(() => app.insert(signature, invalidMessage as any), {
		message: "error encoding message (invalid payload)",
	})
})

test("create an app with an inline contract", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
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
				async createPost(db, { content }: { content: string }, { id, did, timestamp }) {
					const postId = [did, id].join("/")
					await db.set("posts", { id: postId, content, timestamp, address: did })
				},
			},
		},
		start: false,
		signers: [new SIWESigner({ signer: wallet })],
	})

	t.teardown(() => app.stop())

	const { id, message } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is(value?.address, `did:pkh:eip155:1:${wallet.address}`)
})

test("get a value set by another action", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize({
		topic: "com.example.app",
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			models: {
				user: { id: "primary", name: "string" },
				post: { id: "primary", from: "@user", content: "string" },
			},
			actions: {
				async createUser(db, { name }: { name: string }, { did }) {
					await db.set("user", { id: did, name })
				},
				async createPost(db, { content }: { content: string }, { id, did }) {
					const user = await db.get("user", did)
					assert(user !== null)
					await db.set("post", { id, from: did, content })
				},
				async deletePost(db, { id }: { id: string }, { did }) {
					const post = await db.get("post", id)
					if (post !== null) {
						assert(post.from === did, "cannot delete others' posts")
						await db.delete("post", id)
					}
				},
			},
		},
		start: false,
	})

	t.teardown(() => app.stop())

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
			{ id: a, from: `did:pkh:eip155:1:${wallet.address}`, content: "foo" },
			{ id: b, from: `did:pkh:eip155:1:${wallet.address}`, content: "bar" },
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
					},
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
		start: false,
	})

	t.teardown(() => app.stop())

	const { id } = await app.actions.createPost({ content: "hello world!", inReplyTo: null })

	// validate that the args are represented as tuples inside the action
	const messageRecord = await app.getMessage(id)
	assert(messageRecord !== null)
	const message = messageRecord.message
	assert(message !== null && message.payload.type === "action")
	t.deepEqual(message.payload.args, ["hello world!", null])

	await t.throwsAsync(() => app.actions.createPost({ content: 8 } as any), {
		message: "action args did not validate the provided schema type",
	})

	t.is(await app.db.count("posts"), 1)
})

test("apply an action and read a record from the database using eip712", async (t) => {
	const { app } = await initEIP712(t)

	const { id, message } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		something: -1,
		metadata: 0,
	})

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	const { id: id2, message: message2 } = await app.actions.createPost({
		content: "foo bar",
		isVisible: true,
		something: -1,
		metadata: 0,
	})

	t.log(`applied action ${id2}`)
	const postId2 = [message2.payload.did, id2].join("/")
	const value2 = await app.db.get("posts", postId2)
	t.is(value2?.content, "foo bar")
})

test("call quickjs contract with did uri and wallet address", async (t) => {
	const { app, signer } = await initEIP712(t)
	const address = await signer._signer.getAddress()

	const { id, message } = await app.actions.createPost({
		content: "hello world",
		isVisible: true,
		something: -1,
		metadata: 0,
	})

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.address, address)
	t.is(value?.did, `did:pkh:eip155:1:${address}`)
})
