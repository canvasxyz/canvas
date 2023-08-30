import test from "ava"

import type { Action, Message } from "@canvas-js/interfaces"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { getActionContext } from "./utils.js"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)
	await signer.verify(signature, message)
	t.pass()
})

test("create and verify action fail?", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)
	// corrupt the signature
	signature.signature[3] = 1
	const error = t.throwsAsync(async () => {
		await signer.verify(signature, message)
	})
})
