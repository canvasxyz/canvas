import test from "ava"

import type { Action, Message } from "@canvas-js/interfaces"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { getActionContext } from "./utils.js"
import { verifySignature } from "@canvas-js/signed-cid"
import assert from "assert"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)
	t.notThrows(() => verifySignature(signature, message))
	t.notThrows(() => signer.verify(signature, message))
})

test("reject corrupt message signature", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)

	// corrupt the message signature
	signature.signature[3] = 1
	t.throws(() => verifySignature(signature, message))
})

test("reject corrupt session signature", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)
	t.notThrows(() => verifySignature(signature, message))

	// corrupt the session signature
	const session = action.session
	assert(SIWESigner.validateSessionPayload(session))
	session.signature[3] = 1
	t.throws(() => signer.verify(signature, message))
})
