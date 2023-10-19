import assert from "node:assert"
import test from "ava"

import * as cbor from "@ipld/dag-cbor"

import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { decodeId, encodeId } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/memory"
import { collect } from "./utils.js"

const topic = "com.example.test"
const apply = (
	id: string,
	signature: Signature | null,
	message: Message<{ a: string; b: number; c: string | null }>
) => {}

const schema = `
type Thing struct {
  a String
  b Int
  c nullable String
} representation tuple
`

test("validate messages using an IPLD schema", async (t) => {
	const log = await GossipLog.open({
		topic,
		apply,
		validate: { schema, name: "Thing" },
		signatures: false,
	})

	const { id: idA } = await log.append({ a: "foo", b: 1, c: null }, {})
	const { id: idB } = await log.append({ a: "bar", b: 2, c: "hi" }, {})
	const { id: idC } = await log.append({ a: "baz", b: 0, c: null }, {})

	t.deepEqual(await collect(log.iterate()), [
		[idA, null, { topic, clock: 1, parents: [], payload: { a: "foo", b: 1, c: null } }],
		[idB, null, { topic, clock: 2, parents: [idA], payload: { a: "bar", b: 2, c: "hi" } }],
		[idC, null, { topic, clock: 3, parents: [idB], payload: { a: "baz", b: 0, c: null } }],
	])

	{
		const [signature, message] = await log.get(idA)
		assert(message !== null)
		const [key, value] = log.encode(signature, message)
		t.is(decodeId(key), idA)
		t.deepEqual(cbor.decode(value), [null, topic, [], ["foo", 1, null]])
	}

	{
		const [signature, message] = await log.get(idB)
		assert(message !== null)
		const [key, value] = log.encode(signature, message)
		t.is(decodeId(key), idB)
		t.deepEqual(cbor.decode(value), [null, topic, [encodeId(idA)], ["bar", 2, "hi"]])
	}
})
