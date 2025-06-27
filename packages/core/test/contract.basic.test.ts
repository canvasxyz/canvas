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
  static topic = "com.example.app"

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

const initSIWEStringContract = async (t: ExecutionContext) => {
	const signer = new SIWESigner({ burner: true })
	const app = await Canvas.initialize({
		contract,
		reset: true,
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return { app, signer }
}

const initEIP712StringContract = async (t: ExecutionContext) => {
	const signer = new Eip712Signer({ burner: true })
	const app = await Canvas.initialize({
		contract,
		reset: true,
		signers: [signer],
	})
	t.teardown(() => app.stop())
	return { app, signer }
}

const initSIWEClassContract = async (t: ExecutionContext) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static topic = "com.example.app"

		static models = {
			posts: {
				id: "primary",
				content: "string",
				timestamp: "integer",
				address: "string",
				did: "string",
				isVisible: "boolean",
			},
		} satisfies ModelSchema

		// Test individual parameter style
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

	const signer = ethers.Wallet.createRandom()
	const app = await Canvas.initialize({
		contract: MyApp,
		signers: [new SIWESigner({ signer })],
	})

	t.teardown(() => app.stop())
	return { app, signer }
}

test("apply an action and read a record from the database", async (t) => {
	const { app } = await initSIWEStringContract(t)

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
	const { app } = await initSIWEStringContract(t)

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
	const [{ app: a }, { app: b }] = await Promise.all([initSIWEStringContract(t), initSIWEStringContract(t)])

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
	const { app } = await initSIWEStringContract(t)

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
	const { app, signer } = await initSIWEClassContract(t)
	const address = signer.address

	// Test create post functionality
	const { id, message } = await app.actions.createPost("hello world", true)
	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is(value?.did, `did:pkh:eip155:1:${signer.address}`)
	t.is(value?.isVisible, true)

	const [clock] = await app.messageLog.getClock()
	t.is(clock, 3) // session + 1 create

	// Test second create and clock verification
	const { id: id2, message: message2 } = await app.actions.createPost("hello individual", true)
	t.log(`applied action ${id2}`)

	const postId2 = [message2.payload.did, id2].join("/")
	const value2 = await app.db.get("posts", postId2)
	t.is(value2?.content, "hello individual")
	t.is(value2?.isVisible, true)

	const [clock2] = await app.messageLog.getClock()
	t.is(clock2, 4) // session + 2 creates

	// Test update functionality
	const { id: id3 } = await app.actions.updatePost(postId2, "updated content", false)
	const [clock3] = await app.messageLog.getClock()
	t.is(clock3, 5)

	const updatedValue = await app.db.get("posts", postId2)
	t.is(updatedValue?.content, "updated content")
	t.is(updatedValue?.isVisible, false)

	// Test delete functionality
	await app.actions.deletePost(postId2)
	t.is(await app.db.get("posts", postId2), null)

	const [finalClock] = await app.messageLog.getClock()
	t.is(finalClock, 6)
})

test("apply an action and read a record from the database using eip712", async (t) => {
	const { app } = await initEIP712StringContract(t)

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
	const { app, signer } = await initEIP712StringContract(t)
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
		schema: { widgets: { id: "primary", name: "string" } },
	})

	t.teardown(() => app.stop())

	const id = randomUUID()
	await app.db.set("widgets", { id, name: "foobar" })
	t.deepEqual(await app.db.get("widgets", id), { id, name: "foobar" })
})
