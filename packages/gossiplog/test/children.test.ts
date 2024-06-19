import { nanoid } from "nanoid"
import { randomUUID } from "node:crypto"

import { GossipLogConsumer } from "@canvas-js/gossiplog"

import { ed25519 } from "@canvas-js/signatures"
import { testPlatforms } from "./utils.js"

function sorted<T>(list: T[]): T[] {
	return list.slice().sort()
}

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms("get children (append, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const { id } = await log.append(nanoid())
		ids.push(id)
	}

	for (let i = 1; i < n; i++) {
		t.deepEqual(await log.getChildren(ids[i - 1]), [ids[i]], `i=${i}`)
	}
})

testPlatforms("get children (P1 -> C1, P1 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: "foo" }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const c1 = { topic, clock: 2, parents: [parent1], payload: "baz" }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1], payload: "baz2" }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	t.deepEqual(sorted(await log.getChildren(parent1)), sorted([child1, child2]))
})

testPlatforms("get children (P1 -> C1, P1 -> C2, P2 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: "foo" }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const p2 = { topic, clock: 1, parents: [], payload: "foo2" }
	const { id: parent2 } = await log.insert(log.encode(signer.sign(p2), p2))

	const c1 = { topic, clock: 2, parents: [parent1], payload: "baz" }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: "baz2" }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	t.deepEqual(sorted(await log.getChildren(parent1)), sorted([child1, child2]))
	t.deepEqual(sorted(await log.getChildren(parent2)), sorted([child2]))
})

testPlatforms("get children (P1 -> C1, P1 -> C2, P2 -> C2, P1 -> C3, P2 -> C3)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: "foo" }
	const { id: parent1 } = await log.insert(log.encode(signer.sign(p1), p1))

	const p2 = { topic, clock: 1, parents: [], payload: "foo2" }
	const { id: parent2 } = await log.insert(log.encode(signer.sign(p2), p2))

	const c1 = { topic, clock: 2, parents: [parent1], payload: "baz" }
	const { id: child1 } = await log.insert(log.encode(signer.sign(c1), c1))

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: "baz2" }
	const { id: child2 } = await log.insert(log.encode(signer.sign(c2), c2))

	const c3 = { topic, clock: 2, parents: [parent1, parent2], payload: "baz3" }
	const { id: child3 } = await log.insert(log.encode(signer.sign(c3), c3))

	t.deepEqual(sorted(await log.getChildren(parent1)), sorted([child1, child2, child3]))
	t.deepEqual(sorted(await log.getChildren(parent2)), sorted([child2, child3]))
})
