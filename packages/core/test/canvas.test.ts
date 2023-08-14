import test from "ava"

import { Canvas } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const contract = `
const db = openDB("data", {
	posts: {
		content: "string",
		timestamp: "integer",
	}
});

console.log(typeof db, db instanceof Promise)

// addActionHandler({
// 	topic: "com.example",
// 	actions: {
// 		createPost()
// 	}
// })
`.trim()

test("create and close a canvas core", async (t) => {
	const app = await Canvas.initialize({ contract })
	await app.close()
	t.pass()
})

test("create a signed action", async (t) => {
	const signer = await SIWESigner.init({})
	const app = await Canvas.initialize({ contract, signers: [signer] })
	await app.close()
	t.pass()
})
