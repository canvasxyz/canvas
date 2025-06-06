import assert from "node:assert"
import { randomUUID } from "node:crypto"
import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"

import type { GossipLogConsumer } from "@canvas-js/gossiplog"
import { testPlatforms, expectLogEntries } from "./utils.js"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms("append messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = ed25519.create()
	const { id: idA } = await log.append("foo", { signer })
	const { id: idB } = await log.append("bar", { signer })
	const { id: idC } = await log.append("baz", { signer })

	await expectLogEntries(t, log, [
		[idA, signer.publicKey, { topic, clock: 1, parents: [], payload: "foo" }],
		[idB, signer.publicKey, { topic, clock: 2, parents: [idA], payload: "bar" }],
		[idC, signer.publicKey, { topic, clock: 3, parents: [idB], payload: "baz" }],
	])
})

testPlatforms("insert concurrent messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = ed25519.create()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(log.encode(signer.sign(a), a))
	const { id: idB } = await log.insert(log.encode(signer.sign(b), b))
	const { id: idC } = await log.insert(log.encode(signer.sign(c), c))

	const entries: [string, string, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(
		await log
			.getMessages()
			.then((results) => results.map(({ id, signature: { publicKey }, message }) => [id, publicKey, message])),
		entries,
	)
})

testPlatforms("clear messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = ed25519.create()
	const { id: idA } = await log.append("foo", { signer })
	await expectLogEntries(t, log, [[idA, signer.publicKey, { topic, clock: 1, parents: [], payload: "foo" }]])

	await log.close()

	const log2 = await openGossipLog(t, { topic, apply, clear: true })
	await expectLogEntries(t, log2, [])
})

testPlatforms("append to multiple parents", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = ed25519.create()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(log.encode(signer.sign(a), a))
	const { id: idB } = await log.insert(log.encode(signer.sign(b), b))
	const { id: idC } = await log.insert(log.encode(signer.sign(c), c))

	const entries: [string, string, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	const payload = nanoid()
	const { id } = await log.append(payload, { signer })
	const signedMessage = await log.get(id)
	t.deepEqual(signedMessage?.message, { topic, clock: 2, parents: entries.map(([id]) => id), payload })

	await expectLogEntries(t, log, [...entries, [id, signer.publicKey, signedMessage!.message]])
})

testPlatforms("reject invalid message", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, {
		topic,
		apply: ({ message }) => {
			assert(typeof message.payload === "string")
		},
	})

	await t.notThrowsAsync(() => log.append(nanoid()))
	await t.throwsAsync(() => log.append(4))
})

testPlatforms("handle undefined message", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, {
		topic,
		apply: ({ message }) => {},
	})

	const signer = ed25519.create()
	const { id: idA } = await log.append(null, { signer })
	const { id: idB } = await log.append({ key1: 1, key2: undefined }, { signer })
	const { id: idC } = await log.append(undefined, { signer })

	await expectLogEntries(t, log, [
		[idA, signer.publicKey, { topic, clock: 1, parents: [], payload: null }],
		[idB, signer.publicKey, { topic, clock: 2, parents: [idA], payload: { key1: 1 } }],
		[idC, signer.publicKey, { topic, clock: 3, parents: [idB], payload: null }],
	])
})

testPlatforms("handle undefined message when using log.encode() and signer.sign()", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, {
		topic,
		apply: ({ message }) => {},
	})

	const signer = ed25519.create()

	const a = { topic, clock: 1, parents: [], payload: { a: [null] } }
	const { id: idA } = await log.insert(log.encode(signer.sign(a), a))

	const b = { topic, clock: 2, parents: [idA], payload: { b: [undefined] } }
	const { id: idB } = await log.insert(log.encode(signer.sign(b), b))

	const c = { topic, clock: 3, parents: [idB], payload: { foo: null, bar: undefined } }
	const { id: idC } = await log.insert(log.encode(signer.sign(c), c))

	await expectLogEntries(t, log, [
		[idA, signer.publicKey, { topic, clock: 1, parents: [], payload: { a: [null] } }],
		[idB, signer.publicKey, { topic, clock: 2, parents: [idA], payload: { b: [null] } }],
		[idC, signer.publicKey, { topic, clock: 3, parents: [idB], payload: { foo: null } }],
	])
})
