import test from "ava"
import assert from "assert"

import { verifySignature } from "@canvas-js/signed-cid"

import { SIWESigner, validateSessionData } from "@canvas-js/chain-ethereum"
import { Action } from "@canvas-js/interfaces"

test("create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const session = await signer.getSession(topic)
	t.notThrows(() => signer.verifySession(session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	t.notThrows(() => verifySignature(sessionSignature, sessionMessage))
})

test("create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const session = await signer.getSession(topic)
	t.notThrows(() => signer.verifySession(session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	t.notThrows(() => verifySignature(sessionSignature, sessionMessage))

	const action: Action = {
		type: "action",
		address: session.address,
		name: "foo",
		args: { bar: 7 },
		blockhash: null,
		timestamp: session.timestamp,
	}

	const actionMessage = { topic, clock: 1, parents: [], payload: action }
	const actionSignature = await signer.sign(actionMessage)
	t.notThrows(() => verifySignature(actionSignature, actionMessage))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const session = await signer.getSession(topic, {})
	// corrupt the session signature
	session.data.signature[0] = 1
	assert(validateSessionData(session.data))
	session.data.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(session))
})
