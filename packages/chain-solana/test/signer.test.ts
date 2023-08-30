import test from "ava"

import { SolanaSigner } from "@canvas-js/chain-solana"
import { createMessage } from "./utils.js"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SolanaSigner.initWithKeypair()
	const message = await createMessage(signer, topic, "foo", { bar: 7 })
	const signature = await signer.sign(message)
	const { chain, address, session } = message.payload
	await t.notThrowsAsync(async () => signer.verifySession(signature, chain, address, session))
})
