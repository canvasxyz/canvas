import { randomUUID } from "node:crypto"
import type { Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"

import { SignedMessage } from "@canvas-js/gossiplog"
import { expectLogEntries, testPlatforms } from "./utils.js"

testPlatforms("append three messages", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = ed25519.create()
	const log = await openGossipLog(t, { topic, apply: () => {}, signer })

	const { id: foo } = await log.append("foo")
	const { id: bar } = await log.append("bar")
	const { id: baz } = await log.append("baz")

	await expectLogEntries(t, log, [
		[foo, signer.publicKey, { topic, clock: 1, parents: [], payload: "foo" }],
		[bar, signer.publicKey, { topic, clock: 2, parents: [foo], payload: "bar" }],
		[baz, signer.publicKey, { topic, clock: 3, parents: [bar], payload: "baz" }],
	])
})

testPlatforms("insert three concurrent messages and append a fourth", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = ed25519.create()
	const log = await openGossipLog(t, { topic, apply: () => {}, signer })

	const a = { topic, clock: 1, parents: [], payload: "foo" }
	const b = { topic, clock: 1, parents: [], payload: "bar" }
	const c = { topic, clock: 1, parents: [], payload: "baz" }
	const { id: idA } = await log.insert(SignedMessage.encode(signer.sign(a), a))
	const { id: idB } = await log.insert(SignedMessage.encode(signer.sign(b), b))
	const { id: idC } = await log.insert(SignedMessage.encode(signer.sign(c), c))

	const entries: [string, string, Message<string>][] = [
		[idA, signer.publicKey, a],
		[idB, signer.publicKey, b],
		[idC, signer.publicKey, c],
	]

	entries.sort(([a], [b]) => (a < b ? -1 : b < a ? 1 : 0))

	await expectLogEntries(t, log, entries)

	const { id: tailId } = await log.append("qux")

	await expectLogEntries(t, log, [
		...entries,
		[tailId, signer.publicKey, { topic, clock: 2, parents: entries.map(([id]) => id), payload: "qux" }],
	])
})
