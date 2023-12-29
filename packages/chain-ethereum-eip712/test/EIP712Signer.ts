import assert from "assert"
import { expect } from "chai"

import { verifySignedValue } from "@canvas-js/signed-cid"

import { EIP712Signer, validateSessionData } from "@canvas-js/chain-ethereum-eip712"
import { Action } from "@canvas-js/interfaces"

it("should create and verify session", async (t) => {
	const topic = "example:signer"
	const signer = new EIP712Signer()
	const session = await signer.getSession(topic)
	expect(() => {
		signer.verifySession(topic, session)
	}).to.not.throw()

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	// t.notThrows(() => verifySignedValue(sessionSignature, sessionMessage))
	expect(() => {
		verifySignedValue(sessionSignature, sessionMessage)
	}).to.not.throw()
})

it("should create and verify session and action", async (t) => {
	const topic = "example:signer"
	const signer = new EIP712Signer()
	const session = await signer.getSession(topic)
	expect(() => signer.verifySession(topic, session)).to.not.throw()

	const sessionMessage = { topic, clock: 1, parents: [], payload: session }
	const sessionSignature = await signer.sign(sessionMessage)
	expect(() => verifySignedValue(sessionSignature, sessionMessage)).to.not.throw()

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
	expect(() => verifySignedValue(actionSignature, actionMessage)).to.not.throw()
})

it("should reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = new EIP712Signer()
	const session = await signer.getSession(topic, {})
	// corrupt the session signature
	session.authorizationData.signature[0] = 1
	assert(validateSessionData(session.authorizationData))
	session.authorizationData.signature[3] = 1
	expect(async () => signer.verifySession(topic, session)).to.throw()
})
