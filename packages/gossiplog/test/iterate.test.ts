import { randomUUID } from "node:crypto"

import type { Message } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"
import { collect, getPublicKey, testPlatforms } from "./utils.js"

testPlatforms("append three messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = new Ed25519DelegateSigner()
	const log = await openGossipLog(t, { topic, apply: () => {}, signer })

	const { id: foo } = await log.append("foo")
	const { id: bar } = await log.append("bar")
	const { id: baz } = await log.append("baz")

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[foo, signer.uri, { topic, clock: 1, parents: [], payload: "foo" }],
		[bar, signer.uri, { topic, clock: 2, parents: [foo], payload: "bar" }],
		[baz, signer.uri, { topic, clock: 3, parents: [bar], payload: "baz" }],
	])
})

testPlatforms("insert three concurrent messages and append a fourth", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = new Ed25519DelegateSigner()
	const log = await openGossipLog(t, { topic, apply: () => {}, signer })

	const a = { topic, clock: 1, parents: [], payload: "foo" }
	const b = { topic, clock: 1, parents: [], payload: "bar" }
	const c = { topic, clock: 1, parents: [], payload: "baz" }
	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, string, Message<string>][] = [
		[idA, signer.uri, a],
		[idB, signer.uri, b],
		[idC, signer.uri, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)

	const { id: tailId } = await log.append("qux")

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		...entries,
		[tailId, signer.uri, { topic, clock: 2, parents: entries.map(([id]) => id), payload: "qux" }],
	])
})
