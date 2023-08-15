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
		createPost() {}
	}
})

addCustomActionHandler({
	topic: "com.example.app",
	apply(event, env) {}
})
`.trim()

test("create and close an app", async (t) => {
	const app = await Canvas.initialize({ contract, offline: true })
	await app.close()
	t.pass()
})
