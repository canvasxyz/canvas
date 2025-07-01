import test, { ExecutionContext } from "ava"
import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Contract } from "@canvas-js/core/contract"
import { Canvas } from "@canvas-js/core/sync"
import { ModelSchema } from "@canvas-js/modeldb"

const contract = `
import { Contract } from "@canvas-js/core/contract"

export default class MyApp extends Contract {
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
`.trim()

class MyApp extends Contract<typeof MyApp.models> {
	static topic = "com.example.app"
	static models = {
		posts: {
			id: "primary",
			content: "string",
			timestamp: "integer",
			address: "string",
		},
	} satisfies ModelSchema

	async createPost({ content }: { content: string }) {
		const { id, did, timestamp, db, address } = this
		const postId = [did, id].join("/")
		await db.set("posts", { id: postId, content, timestamp, address })
		return content
	}

	async deletePost({ postId }: { postId: string }) {
		const { did, db } = this
		if (!postId.startsWith(did + "/")) {
			throw new Error("unauthorized")
		}
		await db.delete("posts", postId)
	}
}

const initStringContract = (t: ExecutionContext) => {
	const signer = new SIWESigner({ burner: true })
	const app = new Canvas({
		contract,
		reset: true,
		signers: [signer],
	})

	t.teardown(async () => {
		await app.initPromise
		await app.stop()
	})
	return { app, signer }
}

const initInlineContract = (t: ExecutionContext) => {
	const wallet = ethers.Wallet.createRandom()
	const app = new Canvas({
		contract: MyApp,
		signers: [new SIWESigner({ signer: wallet })],
	})

	t.teardown(async () => {
		await app.initPromise
		await app.stop()
	})
	return { app, wallet }
}

test("synchronous string contract: apply an action and read a record from the database", async (t) => {
	const { app } = initStringContract(t)

	const { id, message } = await app.actions.createPost("hello", true, {})

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)

	// Verify all fields are stored correctly
	t.is(value?.content, "hello")
	t.is(value?.isVisible, true)
	t.is(value?.did, message.payload.did)
	t.truthy(value?.timestamp)
	t.truthy(value?.address)
})

test("synchronous string contract: create and delete a post", async (t) => {
	const { app } = initStringContract(t)

	const { id, message } = await app.actions.createPost("hello world", true, { author: "me" })

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
	t.is(value?.isVisible, true)
	t.is((value?.metadata as any).author, "me")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})

test("synchronous inline contract: apply an action and read a record from the database", async (t) => {
	const { app, wallet } = initInlineContract(t)

	const { id, message } = await app.actions.createPost({ content: "hello" })

	t.log(`applied action ${id}`)
	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)

	t.is(value?.content, "hello", "content matches")
	t.is(value?.address, wallet.address, "address matches")
	t.truthy(value?.timestamp, "timestamp is set")
	t.is(value?.id, postId, "postId matches")
})

test("synchronous inline contract: create and delete a post", async (t) => {
	const { app, wallet } = initInlineContract(t)

	const { id, message } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id}`)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)

	t.is(value?.content, "hello world", "content matches")
	t.is(value?.address, wallet.address, "address matches")
	t.truthy(value?.timestamp, "timestamp is set")

	await app.actions.deletePost({ postId })
	t.is(await app.db.get("posts", postId), null, "post should be deleted")
})
