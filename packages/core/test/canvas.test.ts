import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"

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

	async hello(db, args, { chain, address }) {
		console.log("hello from", [chain, address].join(":"))
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

test("log a message", async (t) => {
	const messages: any[] = []
	const app = await Canvas.initialize({
		contract,
		offline: true,
		contractLog: (...args) => {
			t.log("[vm]", ...args)
			messages.push(args)
		},
	})

	t.teardown(() => app.close())

	await app.actions.hello({})

	const { chain, address } = app.signers[0]
	t.deepEqual(messages, [["hello from", [chain, address].join(":")]])
	t.pass()
})
