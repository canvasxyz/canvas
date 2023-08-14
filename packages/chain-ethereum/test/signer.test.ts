import test from "ava"

import { SIWESigner } from "@canvas-js/chain-ethereum"

import { getActionContext } from "./utils.js"

test("create and verify action", async (t) => {
	const topic = "example:signer"
	const signer = await SIWESigner.init({})
	const signed = await signer.create("foo", { bar: 7 }, getActionContext(topic), {})
	await signer.verify(signed)
	t.pass()
})
