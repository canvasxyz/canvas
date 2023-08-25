import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"
import { base32 } from "multiformats/bases/base32"

const contract = `
export const models = {
  posts: {
    $type: "immutable",
    author: "string",
    content: "string",
    timestamp: "integer",
  },
};

export const actions = {
  async createPost(db, { content }, { chain, address, timestamp }) {
    const postId = await db.posts.add({ author: chain, content, timestamp });
    return postId;
  },
};
`.trim()

test("open and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.pass()
})

// test("apply an action and read a record from the database", async (t) => {
// 	const app = await Canvas.initialize({ contract, listen: ["/ip4/127.0.0.1/tcp/9000/ws"] })
// 	t.teardown(() => app.close())

// 	const { key, result: postId } = await app.actions.createPost({ content: "hello world" })

// 	t.log("applied action", base32.baseEncode(key), "and got postId", postId)
// 	assert(typeof postId === "string")
// 	const value = await app.db.get("posts", postId)
// 	t.is(value?.content, "hello world")
// })
