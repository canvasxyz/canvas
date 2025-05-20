import { randomUUID } from "node:crypto"
import test, { ExecutionContext } from "ava"

import { ethers } from "ethers"
import { assert } from "@canvas-js/utils"

import type { Action, Message, Session } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { SIWESigner, Eip712Signer } from "@canvas-js/signer-ethereum"
import { CosmosSigner } from "@canvas-js/signer-cosmos"
import { Canvas, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

const contract = `
import { Contract } from "@canvas-js/core/contract"

export default class extends Contract {
  static models = {
    posts: {
      id: "primary",
      content: "string",
      address: "string",
      did: "string",
      timestamp: "integer",
      isVisible: "boolean",
  		metadata: "json"
    },
  }

  async createPost(content, isVisible, metadata) {
    const { id, did, address, timestamp, db } = this
    const postId = [did, id].join("/")
    await db.transaction(() => db.set("posts", { id: postId, content, address, did, isVisible, timestamp, metadata }));
  }

  async updatePost(postId, content, isVisible, metadata) {
    const { id, did, address, timestamp, db } = this
    const post = await db.get("posts", postId)
    if (post.did !== did) throw new Error("can only update own posts")
    await db.transaction(() => db.update("posts", { id: postId, content, isVisible, metadata }));
  }

  async deletePost(key) {
    const { did, db } = this
		if (!key.startsWith(did + "/")) {
			throw new Error("unauthorized")
		}

		await db.delete("posts", key)
  }
}
`

const init = async (t: ExecutionContext) => {
	const signer = new SIWESigner({ burner: true })
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
	const signer = new Eip712Signer({ burner: true })
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

	const [clock] = await app.messageLog.getClock()
	t.is(clock, 3)

	const { id: id2 } = await app.actions.createPost("bumping this thread again", true, {})
	t.log(`applied action ${id2}`)
	const [clock2] = await app.messageLog.getClock()
	t.is(clock2, 4)

	const { id: id3 } = await app.actions.updatePost(postId, "update", false, {})
	const [clock3] = await app.messageLog.getClock()
	t.is(clock3, 5)
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
	const siweSigner = new SIWESigner({ burner: true })
	const eipSigner = new Eip712Signer({ burner: true })
	const cosmosSigner = new CosmosSigner()

	const getApp = async () => {
		class MyApp extends Contract<typeof MyApp.models> {
			static models = {} satisfies ModelSchema
			async createPost(content: string) {
				//
			}
		}

		const app = await Canvas.initialize({
			topic: "test",
			contract: MyApp,
			reset: true,
			signers: [siweSigner, cosmosSigner],
		})

		t.teardown(() => app.stop())
		return app
	}

	const a = await getApp()
	const b = await getApp()

	await a.as(siweSigner).createPost("hello siwe")
	await a.as(cosmosSigner).createPost("hello cosmos")
	await t.throwsAsync(() => a.as(eipSigner).createPost("hello eip712"))

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
		message: "error encoding message: invalid payload",
	})
})

test("accept a manually encoded session/action with a legacy-style object arg", async (t) => {
	t.plan(1)

	const signer = new SIWESigner({ burner: true })

	class MyApp extends Contract<typeof MyApp.models> {
		static models = {} satisfies ModelSchema

		async createMessage(arg: string) {
			t.deepEqual(arg, { objectArg: "1" })
		}
	}

	const app = await Canvas.initialize({
		contract: MyApp,
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
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			posts: {
				id: "primary",
				content: "string",
				timestamp: "integer",
				address: "string",
			},
		} satisfies ModelSchema

		async createPost({ content }: { content: string }) {
			const { id, did, timestamp, db } = this
			const postId = [did, id].join("/")
			await db.set("posts", { id: postId, content, timestamp, address: did })
			return content
		}
	}

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
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
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			game: { id: "primary", state: "json", label: "string" },
		} satisfies ModelSchema

		async createGame() {
			await this.db.transaction(() =>
				this.db.set("game", {
					id: "0",
					state: { started: false, player1: "foo", player2: "bar" },
					label: "foobar",
				}),
			)
		}

		async updateGame() {
			await this.db.transaction(() =>
				this.db.merge("game", {
					id: "0",
					state: { started: true } as any,
					label: "foosball",
				}),
			)
		}

		async updateGameMultipleMerges() {
			await this.db.transaction(async () => {
				await this.db.merge("game", { id: "0", state: { extra1: { a: 1, b: 1 } } })
				await this.db.merge("game", { id: "0", state: { extra2: "b" } })
				await this.db.merge("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
			})
		}

		async updateGameMultipleUpdates() {
			await this.db.transaction(async () => {
				await this.db.update("game", { id: "0", state: { extra1: { a: 1, b: 2 } } })
				await this.db.update("game", { id: "0", state: { extra3: null, extra1: { b: 2, c: 3 } } })
			})
		}
	}

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
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

test("merge and get execute in order", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			test: { id: "primary", foo: "string?", bar: "string?", qux: "string?" },
		} satisfies ModelSchema

		async testMerges() {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "0", foo: null, bar: null, qux: "foo" })
				await this.db.merge("test", { id: "0", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "0", bar: "bar" })
				return await this.db.get("test", "0")
			})
		}

		async testGet(): Promise<any> {
			return await this.db.transaction(async () => {
				await this.db.set("test", { id: "1", foo: null, bar: null, qux: "foo" })
				const result = await this.db.get("test", "1")
				await this.db.merge("test", { id: "1", foo: "foo", qux: "qux" })
				await this.db.merge("test", { id: "1", bar: "bar" })
				return result
			})
		}
	}

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
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
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			user: { id: "primary", name: "string" },
			post: { id: "primary", from: "@user", content: "string" },
		} satisfies ModelSchema

		async createUser({ name }: { name: string }) {
			const { did, db } = this
			await db.set("user", { id: did, name })
		}

		async createPost({ content }: { content: string }) {
			const { id, did, db } = this
			const user = await db.get("user", did)
			assert(user !== null)
			await db.set("post", { id, from: did, content })
		}

		async deletePost({ id }: { id: string }) {
			const { did, db } = this
			const post = await db.get("post", id)
			if (post !== null) {
				assert(post.from === did, "cannot delete others' posts")
				await db.delete("post", id)
			}
		}
	}

	const wallet = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		topic: "com.example.app",
		signers: [new SIWESigner({ signer: wallet })],
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	const { id } = await app.actions.createUser({ name: "John Doe" })
	t.log(`${id}: created user`)
	const { id: a } = await app.actions.createPost({ content: "foo" })
	t.log(`${a}: created post`)
	const { id: b } = await app.actions.createPost({ content: "bar" })
	t.log(`${b}: created post`)

	const compareIDs = ({ id: a }: { id: string }, { id: b }: { id: string }) => (a < b ? -1 : a === b ? 0 : 1)

	const results = await app.db.getAll<{ id: string; from: string; content: string }>("post")

	t.deepEqual(
		results.sort(compareIDs),
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
	assert(signer._signer !== null)
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

test("class function runtime", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static models = {
			posts: {
				id: "primary",
				content: "string",
				address: "string",
				did: "string",
				timestamp: "integer",
				isVisible: "boolean",
			},
		} satisfies ModelSchema

		async createPost(content: string, isVisible: boolean) {
			const { id, did, address, timestamp, db } = this
			const postId = [did, id].join("/")
			await db.transaction(() => db.set("posts", { id: postId, content, address, did, isVisible, timestamp }))
		}

		async updatePost(postId: string, content: string, isVisible: boolean) {
			const { id, did, address, timestamp, db } = this
			const post = await db.get("posts", postId)
			if (post?.did !== did) throw new Error("can only update own posts")
			await db.transaction(() => db.update("posts", { id: postId, content, isVisible }))
		}

		async deletePost(key: string) {
			const { did, db } = this
			if (!key.startsWith(did + "/")) {
				throw new Error("unauthorized")
			}

			await db.delete("posts", key)
		}
	}

	const app = await Canvas.initialize({
		topic: "com.example.app",
		contract: MyApp,
	})

	t.teardown(() => app.stop())

	const { id, message } = await app.actions.createPost("hello", true)

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const [clock] = await app.messageLog.getClock()
	t.is(clock, 3)

	const { id: id2 } = await app.actions.createPost("bumping this thread again", true)
	t.log(`applied action ${id2}`)
	const [clock2] = await app.messageLog.getClock()
	t.is(clock2, 4)

	const { id: id3 } = await app.actions.updatePost(postId, "update", false)
	const [clock3] = await app.messageLog.getClock()
	t.is(clock3, 5)
})
