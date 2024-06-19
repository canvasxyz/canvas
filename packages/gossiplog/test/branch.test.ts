import { nanoid } from "nanoid"
import { randomUUID } from "node:crypto"

import { GossipLogConsumer } from "@canvas-js/gossiplog"
import { ed25519 } from "@canvas-js/signatures"

import { testPlatforms } from "./utils.js"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms("branch (append, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const { id } = await log.append(nanoid())
		ids.push(id)
	}

	for (let i = 1; i < n; i++) {
		const message = await log.db.get("$messages", ids[i - 1])
		t.deepEqual(message!.branch, 0, `i=${i}`)
	}
})

testPlatforms("branch (insert, unconnected messages)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await log.insert(log.encode(signer.sign(p2), p2))

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)
})

testPlatforms("branch (insert, P1 -> C1, P1 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)
})

testPlatforms("branch (P1 -> C1, P1 -> C2, P2 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await log.insert(log.encode(signer.sign(p2), p2))

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)
})

testPlatforms("branch (P1 -> C1, P1 -> C2, P2 -> C2, P1 -> C3, P2 -> C3)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await log.insert(log.encode(signer.sign(p2), p2))

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	const c3 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child3 } = await log.insert(log.encode(signer.sign(c3), c3))

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child3))!.branch, 2)
})
