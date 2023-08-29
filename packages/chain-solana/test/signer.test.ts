import test from "ava"

import type { Action, Message } from "@canvas-js/interfaces"

import { SolanaSigner } from "@canvas-js/chain-solana"
import { getActionContext } from "./utils.js"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SolanaSigner.init({})
	const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
	const signature = signer.sign(message)
	signer.verify(signature, message)
	t.pass()
})
