import test from "ava"

import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { MessageLog } from "@canvas-js/gossiplog/memory"
import { Ed25519Signer, collect } from "./utils.js"

const topic = "com.example.test"
const apply = (id: string, signature: Signature | null, message: Message<string>) => {}
const validate = (payload: unknown): payload is string => true
const getPublicKey = ([id, signature, message]: [string, Signature | null, Message<string>]) =>
	[id, signature?.publicKey ?? null, message] as const

test("append signed messages", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate })

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

test("append unsigned messages", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate, signatures: false })

	const { id: idA } = await log.append("foo")
	const { id: idB } = await log.append("bar")
	const { id: idC } = await log.append("baz")

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[idA, null, { topic, clock: 1, parents: [], payload: "foo" }],
		[idB, null, { topic, clock: 2, parents: [idA], payload: "bar" }],
		[idC, null, { topic, clock: 3, parents: [idB], payload: "baz" }],
	])
})

test("append signed messages without sequencing", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate, sequencing: false })
	const signer = new Ed25519Signer()
	const { id: idA } = await log.append("foo", { signer })
	const { id: idB } = await log.append("bar", { signer })
	const { id: idC } = await log.append("baz", { signer })

	const entries: [string, Uint8Array, Message<string>][] = [
		[idA, signer.publicKey, { topic, clock: 0, parents: [], payload: "foo" }],
		[idB, signer.publicKey, { topic, clock: 0, parents: [], payload: "bar" }],
		[idC, signer.publicKey, { topic, clock: 0, parents: [], payload: "baz" }],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)
})

test("append unsigned messages without sequencing", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate, signatures: false, sequencing: false })

	const { id: idA } = await log.append("foo")
	const { id: idB } = await log.append("bar")
	const { id: idC } = await log.append("baz")

	const entries: [string, null, Message<string>][] = [
		[idA, null, { topic, clock: 0, parents: [], payload: "foo" }],
		[idB, null, { topic, clock: 0, parents: [], payload: "bar" }],
		[idC, null, { topic, clock: 0, parents: [], payload: "baz" }],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), getPublicKey), entries)
})

test("insert concurrent messages", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate, signatures: false })

	const [a, b, c] = [nanoid(), nanoid(), nanoid()]
	const { id: idA } = await log.insert(null, { topic, clock: 1, parents: [], payload: a })
	const { id: idB } = await log.insert(null, { topic, clock: 1, parents: [], payload: b })
	const { id: idC } = await log.insert(null, { topic, clock: 1, parents: [], payload: c })

	const entries: [string, null, Message<string>][] = [
		[idA, null, { topic, clock: 1, parents: [], payload: a }],
		[idB, null, { topic, clock: 1, parents: [], payload: b }],
		[idC, null, { topic, clock: 1, parents: [], payload: c }],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate()), entries)
})

test("append to multiple parents", async (t) => {
	const log = await MessageLog.open({ topic, apply, validate, signatures: false })

	const [a, b, c] = [nanoid(), nanoid(), nanoid()]
	const { id: idA } = await log.insert(null, { topic, clock: 1, parents: [], payload: a })
	const { id: idB } = await log.insert(null, { topic, clock: 1, parents: [], payload: b })
	const { id: idC } = await log.insert(null, { topic, clock: 1, parents: [], payload: c })

	const entries: [string, null, Message<string>][] = [
		[idA, null, { topic, clock: 1, parents: [], payload: a }],
		[idB, null, { topic, clock: 1, parents: [], payload: b }],
		[idC, null, { topic, clock: 1, parents: [], payload: c }],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	const payload = nanoid()
	const { id } = await log.append(payload)
	const [signature, message] = await log.get(id)
	t.is(signature, null)
	t.deepEqual(message, { topic, clock: 2, parents: entries.map(([id]) => id), payload })
	t.deepEqual(await collect(log.iterate()), [...entries, [id, null, message]])
})
