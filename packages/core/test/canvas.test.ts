import test from "ava"

import { Canvas } from "@canvas-js/core"
import assert from "assert"

const contract = `
const db = openDB("data", {
	posts: {
		content: "string",
		timestamp: "integer",
	}
});

addActionHandler({
	topic: "com.example.app",
	actions: {
		async createPost({ content }, { timestamp }) {
			console.log("createPost", content, timestamp)
			const id = await db.posts.add({ content, timestamp })
			return id
		}
	}
})
`.trim()

test("open and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.timeout(5000)

	t.pass()
})

test("send an ", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	t.teardown(() => app.close())
	t.timeout(5000)

	const { result } = await app.applyAction("com.example.app", {
		name: "createPost",
		args: { content: "hello world" },
	})

	const db = app.dbs.get("data")
	assert(db !== undefined)

	assert(typeof result === "string")
	const value = await db.get("posts", result)
	t.is(value?.content, "hello world")
})
