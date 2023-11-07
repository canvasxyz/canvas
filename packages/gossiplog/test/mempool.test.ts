import { randomUUID } from "node:crypto"
import type { Signature, Message } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"
import { decodeId } from "@canvas-js/gossiplog"

import { testPlatforms } from "./utils.js"

testPlatforms("insert messages out-of-order", async (t, openGossipLog) => {
	const results: { id: string; payload: string }[] = []

	const topic = randomUUID()
	const apply = (id: string, signature: Signature, message: Message<string>) => {
		results.push({ id, payload: message.payload })
	}

	const validate = (payload: unknown): payload is string => typeof payload === "string"

	const log = await openGossipLog(t, { topic, apply, validate })

	const signer = new Ed25519Signer()

	const messageA = { topic, clock: 1, parents: [], payload: "foo" }
	const signatureA = signer.sign(messageA)
	const [keyA] = log.encode(signatureA, messageA)
	const idA = decodeId(keyA)

	const messageB = { topic, clock: 2, parents: [idA], payload: "bar" }
	const signatureB = signer.sign(messageB)
	const [keyB] = log.encode(signatureB, messageB)
	const idB = decodeId(keyB)

	const messageC = { topic, clock: 3, parents: [idB], payload: "baz" }
	const signatureC = signer.sign(messageC)
	const [keyC] = log.encode(signatureC, messageC)
	const idC = decodeId(keyC)

	await log.insert(signatureC, messageC)
	await log.insert(signatureB, messageB)
	await log.insert(signatureA, messageA)

	t.deepEqual(results, [
		{ id: idA, payload: "foo" },
		{ id: idB, payload: "bar" },
		{ id: idC, payload: "baz" },
	])
})
