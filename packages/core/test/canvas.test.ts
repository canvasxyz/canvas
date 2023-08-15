import test from "ava"

import { Canvas } from "@canvas-js/core"

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
			await db.posts.add({ content, timestamp })
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

	try {
		await app.applyAction("com.example.app", { name: "createPost", args: { content: "hello world" } })
	} catch (err) {
		console.error(err, err instanceof Error)
		throw err
	}
	t.pass()
})
