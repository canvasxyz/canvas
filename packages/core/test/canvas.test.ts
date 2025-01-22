import { randomUUID } from "node:crypto"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"

import type { Action, Message, Session } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { SIWESigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { Canvas, Config } from "@canvas-js/core"
import { assert } from "@canvas-js/utils"

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
  async createPost(db, content, isVisible, metadata) {
    const { id, did, address, timestamp } = this
    const postId = [did, id].join("/")
    await db.set("posts", { id: postId, content, address, did, isVisible, timestamp, metadata });
  },

  async updatePost(db, postId, content, isVisible, metadata) {
    const { id, did, address, timestamp } = this
    const post = await db.get("posts", postId)
    if (post.did !== did) throw new Error("can only update own posts")
    await db.update("posts", { id: postId, content, isVisible, metadata });
  },

  async deletePost(db, key) {
		const { did } = this
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
		reset: true,
		signers: [signer],
	})
	t.teardown(() => app.stop())
	return { app, signer }
}

test("apply an action and read a record from the database", async (t) => {
	const { app } = await init(t)

	const { id, message } = await app.actions.createPost("hello", true, {})

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const clock = await app.messageLog.getClock()
	t.is(clock[0], 3)

	const { id: id2 } = await app.actions.createPost("bumping this thread again", true, {})
	t.log(`applied action ${id2}`)
	const clock2 = await app.messageLog.getClock()
	t.is(clock2[0], 4)

	const { id: id3 } = await app.actions.updatePost(postId, "update", false, {})
	const clock3 = await app.messageLog.getClock()
	t.is(clock3[0], 5)
})

test("create and delete a post", async (t) => {
	const { app } = await init(t)

	const { id, message } = await app.actions.createPost("hello world", true, { author: "me" })

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

	await a.actions.createPost("hello world", true, "bar", {})
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
				actions: { createPost(db, { content }: { content: string }) {} },
			},
			reset: true,
			signers: [siweSigner, cosmosSigner],
		})
		t.teardown(() => app.stop())
		return app
	}
	const a = await getApp()
	const b = await getApp()

	await a.as(siweSigner).createPost({ content: "hello siwe" })
	await a.as(cosmosSigner).createPost({ content: "hello cosmos" })
	await t.throwsAsync(() => a.as(eipSigner).createPost({ content: "hello eip712" }))

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

test("accept a manually encoded session/action with a legacy-style object arg", async (t) => {
	t.plan(1)

	const signer = new SIWESigner()

	const app = await Canvas.initialize({
		contract: {
			actions: {
				createMessage(db, arg) {
					t.deepEqual(arg, { objectArg: "1" })
				},
			},
			models: {},
		},
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})
	t.teardown(() => app.stop())

	const session = await signer.newSession(app.topic)

	const sessionMessage: Message<Session> = {
		topic: app.topic,
		clock: 1,
		parents: [],
		payload: session?.payload,
	}
	const sessionSignature = await session.signer.sign(sessionMessage)

	const { id: sessionId } = await app.insert(sessionSignature, sessionMessage)

	const actionMessage: Message<Action> = {
		topic: app.topic,
		clock: 2,
		parents: [sessionId],
		payload: {
			type: "action",
			did: sessionMessage.payload.did,
			name: "createMessage",
			args: { objectArg: "1" },
			context: { timestamp: 0 },
		},
	}
	const actionSignature = await session.signer.sign(actionMessage)

	const { id: actionId } = await app.insert(actionSignature, actionMessage)
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
				async createPost(db, { content }: { content: string }) {
					const { id, did, timestamp } = this
					const postId = [did, id].join("/")
					await db.set("posts", { id: postId, content, timestamp, address: did })
					return content
				},
			},
		},
		signers: [new SIWESigner({ signer: wallet })],
	})

	t.teardown(() => app.stop())

	const { id, message, result } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is(value?.address, `did:pkh:eip155:1:${wallet.address}`)
	t.is(result, "hello world")
})

test("merge and update into a value set by another action", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				game: { id: "primary", state: "json", label: "string" },
			},
			actions: {
				async createGame() {
					await this.db.set("game", {
						id: "0",
						state: { started: false, player1: "foo", player2: "bar" },
						label: "foobar",
					})
				},
				async updateGame() {
					await this.db.merge("game", {
						id: "0",
						state: { started: true } as any,
						label: "foosball",
					})
				},
				async updateGameMultipleMerges() {
					await this.db.merge("game", { id: "0", state: { extra1: { a: 1, b: 1 } } })
					await this.db.merge("game", { id: "0", state: { extra2: "b" } })
					await this.db.merge("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
				},
				async updateGameMultipleUpdates() {
					await this.db.update("game", { id: "0", state: { extra1: { a: 1, b: 2 } } })
					await this.db.update("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
				},
			},
		},
	})

	t.teardown(() => app.stop())

	await app.actions.createGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: { started: false, player1: "foo", player2: "bar" },
		label: "foobar",
	})

	await app.actions.updateGame()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: { started: true, player1: "foo", player2: "bar" },
		label: "foosball",
	})

	await app.actions.updateGameMultipleMerges()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			started: true,
			player1: "foo",
			player2: "bar",
			extra1: { a: 1, b: 2, c: 3 },
			extra2: "b",
			extra3: null,
		},
		label: "foosball",
	})

	await app.actions.updateGameMultipleUpdates()
	t.deepEqual(await app.db.get("game", "0"), {
		id: "0",
		state: {
			extra3: null,
			extra1: { b: 2, c: 3 },
		},
		label: "foosball",
	})
})

test("merge and get execute in order, even without await", async (t) => {
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: {
			models: {
				test: { id: "primary", foo: "string?", bar: "string?", qux: "string?" },
			},
			actions: {
				async testMerges() {
					this.db.set("test", { id: "0", foo: null, bar: null, qux: "foo" })
					this.db.merge("test", { id: "0", foo: "foo", qux: "qux" })
					this.db.merge("test", { id: "0", bar: "bar" })
					const result = await this.db.get("test", "0")
					return result
				},
				async testGet(): Promise<any> {
					this.db.set("test", { id: "1", foo: null, bar: null, qux: "foo" })
					const resultPromise = this.db.get("test", "1")
					this.db.merge("test", { id: "1", foo: "foo", qux: "qux" })
					this.db.merge("test", { id: "1", bar: "bar" })
					const result = await resultPromise
					return result
				},
			},
		},
	})

	t.teardown(() => app.stop())

	await app.actions.testMerges()
	t.deepEqual(await app.db.get("test", "0"), {
		id: "0",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})

	const { result } = await app.actions.testGet()
	t.deepEqual(await app.db.get("test", "1"), {
		id: "1",
		foo: "foo",
		bar: "bar",
		qux: "qux",
	})
	t.deepEqual(result, {
		id: "1",
		foo: null,
		bar: null,
		qux: "foo",
	})
})

test("get a value set by another action", async (t) => {
	const wallet = ethers.Wallet.createRandom()

	const app = await Canvas.initialize<{
		user: { id: "primary"; name: "string" }
		post: { id: "primary"; from: "@user"; content: "string" }
	}>({
		topic: "com.example.app",
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			models: {
				user: { id: "primary", name: "string" },
				post: { id: "primary", from: "@user", content: "string" },
			},
			actions: {
				async createUser(db, { name }: { name: string }) {
					const { did } = this
					await db.set("user", { id: did, name })
				},
				async createPost(db, { content }: { content: string }) {
					const { id, did } = this
					const user = await db.get("user", did)
					assert(user !== null)
					await db.set("post", { id, from: did, content })
				},
				async deletePost(db, { id }: { id: string }) {
					const { did } = this
					const post = await db.get("post", id)
					if (post !== null) {
						assert(post.from === did, "cannot delete others' posts")
						await db.delete("post", id)
					}
				},
			},
		},
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

test("apply an action and read a record from the database using eip712", async (t) => {
	const { app } = await initEIP712(t)

	const { id, message } = await app.actions.createPost("hello world", true, -1, 0)

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	const { id: id2, message: message2 } = await app.actions.createPost("foo bar", true, -1, 0)

	t.log(`applied action ${id2}`)
	const postId2 = [message2.payload.did, id2].join("/")
	const value2 = await app.db.get("posts", postId2)
	t.is(value2?.content, "foo bar")
})

test("call quickjs contract with did uri and wallet address", async (t) => {
	const { app, signer } = await initEIP712(t)
	const address = await signer._signer.getAddress()

	const { id, message } = await app.actions.createPost("hello world", true, -1, 0)

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.address, address)
	t.is(value?.did, `did:pkh:eip155:1:${address}`)
})

test("open custom modeldb tables", async (t) => {
	const app = await Canvas.initialize({
		contract,
		topic: "com.example.app",
		schema: { widgets: { id: "primary", name: "string" } },
	})

	t.teardown(() => app.stop())

	const id = randomUUID()
	await app.db.set("widgets", { id, name: "foobar" })
	t.deepEqual(await app.db.get("widgets", id), { id, name: "foobar" })
})

test("create a contract with a yjs text table", async (t) => {
	const config: Config = {
		contract: {
			models: {
				// @ts-ignore
				posts: { id: "primary", content: "yjs-text" },
			},
			actions: {
				postInsert: (db, { key, index, content }: { key: string; index: number; content: string }) => {
					db.yjsInsert("posts", key, index, content)
				},
			},
		},

		topic: "com.example.app",
	}
	const app = await Canvas.initialize(config)

	t.teardown(() => app.stop())

	const post1Id = "post_1"

	// call an action that updates the yjs-text item
	// when you call a yjs action, it will automatically create the table if it doesn't exist
	const message_1 = await app.actions.postInsert({ key: post1Id, index: 0, content: "hello" })

	t.deepEqual(await app.db.query("posts:operations"), [
		{
			record_id: post1Id,
			operation_id: `${post1Id}/${message_1.id}`,
			message_id: message_1.id,
			operations: [
				{
					content: "hello",
					index: 0,
					type: "yjsInsert",
				},
			],
		},
	])

	t.deepEqual(await app.db.query("posts:state"), [
		{
			id: post1Id,
			content: [{ insert: "hello" }],
		},
	])

	// call another action that updates the yjs-text item
	const message_2 = await app.actions.postInsert({ key: post1Id, index: 6, content: " world" })

	// there should be two entries in the operations table now
	t.deepEqual(await app.db.query("posts:operations"), [
		{
			record_id: post1Id,
			operation_id: `${post1Id}/${message_1.id}`,
			message_id: message_1.id,
			operations: [
				{
					content: "hello",
					index: 0,
					type: "yjsInsert",
				},
			],
		},
		{
			record_id: post1Id,
			operation_id: `${post1Id}/${message_2.id}`,
			message_id: message_2.id,
			operations: [{ content: " world", index: 6, type: "yjsInsert" }],
		},
	])

	// the results of the two inserts should be combined
	t.deepEqual(await app.db.query("posts:state"), [
		{
			id: post1Id,
			content: [{ insert: "hello world" }],
		},
	])

	// initialize another app with the same config
	const app2 = await Canvas.initialize(config)

	// sync app -> app2
	await app.messageLog.serve((source) => app2.messageLog.sync(source))

	// assert that app2 now has the same posts data as app
	t.deepEqual(await app2.db.query("posts:operations"), [
		{
			record_id: post1Id,
			operation_id: `${post1Id}/${message_1.id}`,
			message_id: message_1.id,
			operations: [
				{
					content: "hello",
					index: 0,
					type: "yjsInsert",
				},
			],
		},
		{
			record_id: post1Id,
			operation_id: `${post1Id}/${message_2.id}`,
			message_id: message_2.id,
			operations: [{ content: " world", index: 6, type: "yjsInsert" }],
		},
	])

	// the results of the two inserts should be combined
	t.deepEqual(await app2.db.query("posts:state"), [
		{
			id: post1Id,
			content: [{ insert: "hello world" }],
		},
	])

	// apply an action on app
	await app.actions.postInsert({ key: post1Id, index: 11, content: "!" })

	// concurrently apply an action on app2
	await app2.actions.postInsert({ key: post1Id, index: 11, content: "?" })

	// sync app -> app2
	await app.messageLog.serve((source) => app2.messageLog.sync(source))

	// assert that app2 contains both changes
	t.deepEqual(await app2.db.query("posts:state"), [
		{
			id: post1Id,
			content: [{ insert: "hello world!?" }],
		},
	])

	// sync app2 -> app
	await app2.messageLog.serve((source) => app.messageLog.sync(source))

	// assert that app contains both changes
	// and that they are the same as those in app2
	t.deepEqual(await app.db.query("posts:state"), [
		{
			id: post1Id,
			content: [{ insert: "hello world!?" }],
		},
	])
})
