import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"
import { base32 } from "multiformats/bases/base32"

const contract = `
export const models = {
  posts: {
    $type: "mutable",
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

  async deletePost(db, id, { chain, address }) {
    const prefix = [chain, address, ""].join("/")
    if (!id.startsWith(prefix)) {
      throw new Error("unauthorized")
    }

    await db.posts.delete(id)
  }
};
`.trim()

test("open and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.pass()
})

test("apply an action and read a record from the database", async (t) => {
	const app = await Canvas.initialize({ contract, listen: ["/ip4/127.0.0.1/tcp/9000/ws"] })
	t.teardown(() => app.close())

	const { id, result: postId } = await app.actions.createPost({ content: "hello world" })

	t.log(`applied action ${id} and got result`, postId)
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")
})

test("create and delete a post", async (t) => {
	const app = await Canvas.initialize({ contract, listen: ["/ip4/127.0.0.1/tcp/9001/ws"] })
	t.teardown(() => app.close())

	const { result: postId } = await app.actions.createPost({ content: "hello world" })
	assert(typeof postId === "string")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello world")

	await app.actions.deletePost(postId)
	t.is(await app.db.get("posts", postId), null)
})
