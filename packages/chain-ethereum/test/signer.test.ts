import test from "ava"
import assert from "assert"

import { verifySignature } from "@canvas-js/signed-cid"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { createMessage } from "./utils.js"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const message = await createMessage(signer, topic, "foo", { bar: 7 })
	const signature = await signer.sign(message)
	t.notThrows(() => verifySignature(signature, message))

	const { chain, address, session } = message.payload
	await t.notThrowsAsync(async () => signer.verifySession(signature, chain, address, session))
})

test("reject corrupt message signature", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const message = await createMessage(signer, topic, "foo", { bar: 7 })
	const signature = await signer.sign(message)

	// corrupt the message signature
	signature.signature[3] = 1
	t.throws(() => verifySignature(signature, message))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const message = await createMessage(signer, topic, "foo", { bar: 7 })
	const signature = await signer.sign(message)
	t.notThrows(() => verifySignature(signature, message))

	// corrupt the session signature
	const { chain, address, session } = message.payload
	assert(SIWESigner.validateSessionPayload(session))
	session.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(signature, chain, address, session))
})
