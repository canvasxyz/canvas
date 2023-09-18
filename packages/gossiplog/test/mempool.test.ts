import test from "ava"

import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { decodeId, openMessageLog } from "@canvas-js/gossiplog"
import { Ed25519Signer, collect } from "./utils.js"

test("insert messages out-of-order", async (t) => {
	const results: { id: string; payload: string }[] = []

	const topic = "com.example.test"
	const apply = (id: string, signature: Signature | null, message: Message<string>) => {
		results.push({ id, payload: message.payload })
	}

	const validate = (payload: unknown): payload is string => typeof payload === "string"

	const log = await openMessageLog({ location: null, topic, apply, validate, signatures: false })

	const a = { clock: 1, parents: [], payload: "a" }
	const [keyA] = log.encode(null, a)
	const idA = decodeId(keyA)

	const b = { clock: 2, parents: [idA], payload: "b" }
	const [keyB] = log.encode(null, b)
	const idB = decodeId(keyB)

	const c = { clock: 3, parents: [idB], payload: "c" }
	const [keyC] = log.encode(null, c)
	const idC = decodeId(keyC)

	await log.insert(null, c)
	await log.insert(null, b)
	await log.insert(null, a)

	t.deepEqual(results, [
		{ id: idA, payload: "a" },
		{ id: idB, payload: "b" },
		{ id: idC, payload: "c" },
	])
})
