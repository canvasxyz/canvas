import assert from "node:assert"
import test from "ava"

import { Canvas } from "@canvas-js/core"

const contract = `
export const db = openDB({
	posts: {
		content: "string",
		timestamp: "integer",
	}
});

export const actions = addActionHandler({
	topic: "com.example.app",
	actions: {
		async createPost({ content }, { timestamp }) {
			console.log("createPost", content, timestamp)
			const postId = await db.posts.add({ content, timestamp })
			return postId
		}
	}
})
`.trim()

test("open and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.pass()
})

test("apply an action and read a record from the database", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())

	const { id: actionId, result: postId } = await app.applyAction("com.example.app", {
		name: "createPost",
		args: { content: "hello world" },
	})

	t.log("applied action", actionId, "and got postId", postId)

	assert(typeof postId === "string")
	const value = await app.exports.db?.get("posts", postId)
	t.is(value?.content, "hello world")
})
