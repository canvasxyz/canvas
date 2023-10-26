import assert from "node:assert"

import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { Ed25519Signer } from "@canvas-js/gossiplog"
import { collect, getPublicKey, testPlatforms } from "./utils.js"

const topic = "com.example.test"
const apply = (id: string, signature: Signature, message: Message<string>) => {}
const validate = (payload: unknown): payload is string => true

testPlatforms("append signed messages", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate })

	const signer = new Ed25519Signer()
	const { id: idA } = await log.append("foo", { signer })
	const { id: idB } = await log.append("bar", { signer })
	const { id: idC } = await log.append("baz", { signer })

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[idA, signer.publicKey, { topic, clock: 1, parents: [], payload: "foo" }],
		[idB, signer.publicKey, { topic, clock: 2, parents: [idA], payload: "bar" }],
		[idC, signer.publicKey, { topic, clock: 3, parents: [idB], payload: "baz" }],
	])
})

// testPlatforms("append unsigned messages", async (t, openGossipLog) => {
// 	const log = await openGossipLog(t, { topic, apply, validate, signatures: false })

// 	const { id: idA } = await log.append("foo")
// 	const { id: idB } = await log.append("bar")
// 	const { id: idC } = await log.append("baz")

// 	t.deepEqual(await collect(log.iterate(), getPublicKey), [
// 		[idA, null, { topic, clock: 1, parents: [], payload: "foo" }],
// 		[idB, null, { topic, clock: 2, parents: [idA], payload: "bar" }],
// 		[idC, null, { topic, clock: 3, parents: [idB], payload: "baz" }],
// 	])
// })

// testPlatforms("append signed messages without sequencing", async (t, openGossipLog) => {
// 	const log = await openGossipLog(t, { topic, apply, validate, sequencing: false })
// 	const signer = new Ed25519Signer()
// 	const { id: idA } = await log.append("foo", { signer })
// 	const { id: idB } = await log.append("bar", { signer })
// 	const { id: idC } = await log.append("baz", { signer })

// 	const entries: [string, Uint8Array, Message<string>][] = [
// 		[idA, signer.publicKey, { topic, clock: 0, parents: [], payload: "foo" }],
// 		[idB, signer.publicKey, { topic, clock: 0, parents: [], payload: "bar" }],
// 		[idC, signer.publicKey, { topic, clock: 0, parents: [], payload: "baz" }],
// 	]

// 	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

// 	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)
// })

// testPlatforms("append unsigned messages without sequencing", async (t, openGossipLog) => {
// 	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, sequencing: false })

// 	const { id: idA } = await log.append("foo")
// 	const { id: idB } = await log.append("bar")
// 	const { id: idC } = await log.append("baz")

// 	const entries: [string, null, Message<string>][] = [
// 		[idA, null, { topic, clock: 0, parents: [], payload: "foo" }],
// 		[idB, null, { topic, clock: 0, parents: [], payload: "bar" }],
// 		[idC, null, { topic, clock: 0, parents: [], payload: "baz" }],
// 	]

// 	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

// 	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)
// })

testPlatforms("insert concurrent messages", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate })

	const signer = new Ed25519Signer()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, Uint8Array, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), ([id, { publicKey }, message]) => [id, publicKey, message]), entries)
})

testPlatforms("append to multiple parents", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate })

	const signer = new Ed25519Signer()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, Uint8Array, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	const payload = nanoid()
	const { id } = await log.append(payload, { signer })
	const [_, message] = await log.get(id)
	t.deepEqual(message, { topic, clock: 2, parents: entries.map(([id]) => id), payload })
	t.deepEqual(await collect(log.iterate(), getPublicKey), [...entries, [id, signer.publicKey, message]])
})
