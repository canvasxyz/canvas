import test from "ava"
import assert from "assert"

import { Eip712Signer, validateEip712SessionData } from "@canvas-js/signer-ethereum"
import { Action } from "@canvas-js/interfaces"

test("create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new Eip712Signer({ burner: true })
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => signer.scheme.verify(sessionSignature, sessionMessage))

	t.pass()
})

test("create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new Eip712Signer({ burner: true })
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
	t.notThrows(() => signer.verifySession(topic, session))

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await delegateSigner.sign(sessionMessage)
	t.notThrows(() => signer.scheme.verify(sessionSignature, sessionMessage))

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
	t.notThrows(() => signer.scheme.verify(actionSignature, actionMessage))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new Eip712Signer({ burner: true })
	const { payload: session, signer: delegateSigner } = await signer.newSession(topic)

	// corrupt the session signature
	session.authorizationData.signature[0] = 1
	assert(validateEip712SessionData(session.authorizationData))
	session.authorizationData.signature[3] = 1
	await t.throwsAsync(async () => signer.verifySession(topic, session))
})

test("reject session signature for wrong topic", async (t) => {
	const topic = "example:signer"
	const topic2 = "example:signer2"
	const signer = new Eip712Signer({ burner: true })
	const { payload: session } = await signer.newSession(topic)
	const { payload: session2 } = await signer.newSession(topic2)

	await t.throwsAsync(async () => signer.verifySession(topic, session2))
})
