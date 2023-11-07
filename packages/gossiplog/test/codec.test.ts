import assert from "node:assert"

import * as cbor from "@ipld/dag-cbor"

import type { Signature, Message } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"
import { decodeId, encodeId } from "@canvas-js/gossiplog"
import { collect, getPublicKey, testPlatforms } from "./utils.js"
import { base58btc } from "multiformats/bases/base58"

const topic = "com.example.test"
const apply = (id: string, signature: Signature, message: Message<{ a: string; b: number; c: string | null }>) => {}

const schema = `
type Thing struct {
  a String
  b Int
  c nullable String
} representation tuple
`

testPlatforms("validate messages using an IPLD schema", async (t, openGossipLog) => {
	const signer = new Ed25519Signer()
	const [{}, {}, tail] = signer.uri.split(":")
	const publicKey = base58btc.decode(tail)

	const log = await openGossipLog(t, { topic, apply, validate: { schema, name: "Thing" }, signer })

	const { id: idA } = await log.append({ a: "foo", b: 1, c: null })
	const { id: idB } = await log.append({ a: "bar", b: 2, c: "hi" })
	const { id: idC } = await log.append({ a: "baz", b: 0, c: null })

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[idA, signer.uri, { topic, clock: 1, parents: [], payload: { a: "foo", b: 1, c: null } }],
		[idB, signer.uri, { topic, clock: 2, parents: [idA], payload: { a: "bar", b: 2, c: "hi" } }],
		[idC, signer.uri, { topic, clock: 3, parents: [idB], payload: { a: "baz", b: 0, c: null } }],
	])

	{
		const [signature, message] = await log.get(idA)
		assert(signature !== null && message !== null)
		const [key, value] = log.encode(signature, message)
		t.is(decodeId(key), idA)

		t.deepEqual(cbor.decode(value), [publicKey, signature.signature, [], ["foo", 1, null]])
	}

	{
		const [signature, message] = await log.get(idB)
		assert(signature !== null && message !== null)
		const [key, value] = log.encode(signature, message)
		t.is(decodeId(key), idB)

		t.deepEqual(cbor.decode(value), [publicKey, signature.signature, [encodeId(idA)], ["bar", 2, "hi"]])
	}
})
