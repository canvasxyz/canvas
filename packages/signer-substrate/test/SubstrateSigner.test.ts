import test from "ava"
import assert from "assert"

import { ed25519 } from "@canvas-js/signatures"

import { SubstrateSigner, validateSessionData } from "@canvas-js/signer-substrate"
import { Action } from "@canvas-js/interfaces"

test("create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new SubstrateSigner()
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))
})

test("create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new SubstrateSigner()
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => ed25519.verify(sessionSignature, sessionMessage))

	const action: Action = {
		type: "action",
		did: session.did,
		name: "foo",
		args: [7],
		context: {
			timestamp: session.context.timestamp,
		},
	}

	const actionMessage = { topic, clock: 1, parents: [], payload: action }
	const actionSignature = await delegateSigner.sign(actionMessage)
	t.notThrows(() => ed25519.verify(actionSignature, actionMessage))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new SubstrateSigner()
	const { payload: session } = await signer.newSession(topic)
	// corrupt the session signature
	session.authorizationData.signatureResult.signature[0] = 1
	assert(validateSessionData(session.authorizationData))
	session.authorizationData.signatureResult.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(topic, session))
})

test("reject session signature for wrong topic", async (t) => {
	const topic = "example:signer"
	const topic2 = "example:signer2"
	const signer = new SubstrateSigner()
	const { payload: session } = await signer.newSession(topic)
	const { payload: session2 } = await signer.newSession(topic2)

	await t.throwsAsync(async () => signer.verifySession(topic, session2))
})
