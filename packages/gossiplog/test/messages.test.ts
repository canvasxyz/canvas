import { randomUUID } from "node:crypto"
import { nanoid } from "nanoid"

import { Signature, Message } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signatures"

import { collect, getPublicKey, testPlatforms } from "./utils.js"

const apply = (id: string, signature: Signature, message: Message<string>) => {}

testPlatforms("append messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = new Ed25519Signer()
	const { id: idA } = await log.append("foo", { signer })
	const { id: idB } = await log.append("bar", { signer })
	const { id: idC } = await log.append("baz", { signer })

	t.deepEqual(await collect(log.iterate(), getPublicKey), [
		[idA, signer.uri, { topic, clock: 1, parents: [], payload: "foo" }],
		[idB, signer.uri, { topic, clock: 2, parents: [idA], payload: "bar" }],
		[idC, signer.uri, { topic, clock: 3, parents: [idB], payload: "baz" }],
	])
})

testPlatforms("insert concurrent messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = new Ed25519Signer()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, string, Message<string>][] = [
		[idA, signer.uri, a],
		[idB, signer.uri, b],
		[idC, signer.uri, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(await collect(log.iterate(), ([id, { publicKey }, message]) => [id, publicKey, message]), entries)
})

testPlatforms("append to multiple parents", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = new Ed25519Signer()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(signer.sign(a), a)
	const { id: idB } = await log.insert(signer.sign(b), b)
	const { id: idC } = await log.insert(signer.sign(c), c)

	const entries: [string, string, Message<string>][] = [
		[idA, signer.uri, a],
		[idB, signer.uri, b],
		[idC, signer.uri, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	const payload = nanoid()
	const { id } = await log.append(payload, { signer })
	const [_, message] = await log.get(id)
	t.deepEqual(message, { topic, clock: 2, parents: entries.map(([id]) => id), payload })
	t.deepEqual(await collect(log.iterate(), getPublicKey), [...entries, [id, signer.uri, message]])
})
