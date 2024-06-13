import { randomUUID } from "node:crypto"
import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { SignedMessage } from "@canvas-js/gossiplog"

import { testPlatforms, expectLogEntries } from "./utils.js"

const apply = ({}: SignedMessage<string>) => {}

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

	const { id: idA } = await log.insert(SignedMessage.encode(signer.sign(a), a))
	const { id: idB } = await log.insert(SignedMessage.encode(signer.sign(b), b))
	const { id: idC } = await log.insert(SignedMessage.encode(signer.sign(c), c))

	const entries: [string, string, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	t.deepEqual(
		await log
			.export()
			.then((results) => results.map(({ id, signature: { publicKey }, message }) => [id, publicKey, message])),
		entries,
	)
})

testPlatforms("append to multiple parents", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

	const signer = ed25519.create()
	const a = { topic, clock: 1, parents: [], payload: nanoid() }
	const b = { topic, clock: 1, parents: [], payload: nanoid() }
	const c = { topic, clock: 1, parents: [], payload: nanoid() }

	const { id: idA } = await log.insert(SignedMessage.encode(signer.sign(a), a))
	const { id: idB } = await log.insert(SignedMessage.encode(signer.sign(b), b))
	const { id: idC } = await log.insert(SignedMessage.encode(signer.sign(c), c))

	const entries: [string, string, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	const payload = nanoid()
	const { id } = await log.append(payload, { signer })
	const [_, message] = await log.get(id)
	t.deepEqual(message, { topic, clock: 2, parents: entries.map(([id]) => id), payload })

	await expectLogEntries(t, log, [...entries, [id, signer.publicKey, message!]])
})
