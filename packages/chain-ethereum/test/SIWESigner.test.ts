import test from "ava"
import assert from "assert"

import { ed25519 } from "@canvas-js/signatures"

import { SIWESigner, validateSIWESessionData } from "@canvas-js/chain-ethereum"
import { Action } from "@canvas-js/interfaces"

test("create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))
})

test("create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))

	const action: Action = {
		type: "action",
		address: session.address,
		name: "foo",
		args: { bar: 7 },
		blockhash: null,
		timestamp: session.timestamp,
	}

	const actionMessage = { topic, clock: 1, parents: [], payload: action }
	const actionSignature = await delegateSigner.sign(actionMessage)
	t.notThrows(() => ed25519.verify(actionSignature, actionMessage))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new SIWESigner()
	const { payload: session } = await signer.newSession(topic)
	// corrupt the session signature
	session.authorizationData.signature[0] = 1
	assert(validateSIWESessionData(session.authorizationData))
	session.authorizationData.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(topic, session))
})
