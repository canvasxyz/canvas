import test from "ava"
import assert from "assert"

import type { Action } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"

import { SolanaSigner, validateSessionData } from "@canvas-js/chain-solana"

test("create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new SolanaSigner()
	const session = await signer.getSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	t.notThrows(() => Ed25519DelegateSigner.verify(sessionSignature, sessionMessage))
})

test("create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new SolanaSigner()
	const session = await signer.getSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	t.notThrows(() => Ed25519DelegateSigner.verify(sessionSignature, sessionMessage))

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
	t.notThrows(() => Ed25519DelegateSigner.verify(actionSignature, actionMessage))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new SolanaSigner()
	const session = await signer.getSession(topic, {})
	// corrupt the session signature
	session.authorizationData.signature[0] = 1
	assert(validateSessionData(session.authorizationData))
	session.authorizationData.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(topic, session))
})
