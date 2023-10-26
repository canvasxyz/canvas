import type { Message } from "@canvas-js/interfaces"

import { Ed25519Signer } from "@canvas-js/gossiplog"
import { collect, getPublicKey, testPlatforms } from "./utils.js"

const validate = (payload: unknown): payload is string => typeof payload === "string"

testPlatforms("append three messages", async (t, openGossipLog) => {
	const topic = "com.example.test"
	const signer = new Ed25519Signer()
	const log = await openGossipLog(t, { topic, apply: () => {}, validate, signer })

	const { id: foo } = await log.append("foo")
	const { id: bar } = await log.append("bar")
	const { id: baz } = await log.append("baz")

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[foo, signer.publicKey, { topic, clock: 1, parents: [], payload: "foo" }],
		[bar, signer.publicKey, { topic, clock: 2, parents: [foo], payload: "bar" }],
		[baz, signer.publicKey, { topic, clock: 3, parents: [bar], payload: "baz" }],
	])
})

testPlatforms("insert three concurrent messages and append a fourth", async (t, openGossipLog) => {
	const topic = "com.example.test"
	const signer = new Ed25519Signer()
	const log = await openGossipLog(t, { topic, apply: () => {}, validate, signer })

	const a = { topic, clock: 1, parents: [], payload: "foo" }
	const b = { topic, clock: 1, parents: [], payload: "bar" }
	const c = { topic, clock: 1, parents: [], payload: "baz" }
	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, Uint8Array, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)

	const { id: tailId } = await log.append("qux")

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		...entries,
		[tailId, signer.publicKey, { topic, clock: 2, parents: entries.map(([id]) => id), payload: "qux" }],
	])
})
