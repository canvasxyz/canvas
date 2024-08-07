import { nanoid } from "nanoid"
import { randomUUID } from "node:crypto"

import { AbstractGossipLog, GossipLogConsumer, Message } from "@canvas-js/gossiplog"
import { ed25519 } from "@canvas-js/signatures"

import { testPlatforms } from "./utils.js"

const apply: GossipLogConsumer<string> = ({}) => {}

async function insert(log: AbstractGossipLog<any>, signer: ReturnType<typeof ed25519.create>, message: Message<any>) {
	return await log.insert(log.encode(signer.sign(message), message))
}

testPlatforms("branch (append, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })

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
	const log = await openGossipLog(t, { topic, apply })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await insert(log, signer, p1)

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await insert(log, signer, p2)

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)

	const branchMergesResult = await log.db.query("$branch_merges", {})
	t.deepEqual(branchMergesResult, [])
})

testPlatforms("branch (insert, P1 -> C1, P1 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await insert(log, signer, p1)

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await insert(log, signer, c1)

	const c2 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child2 } = await insert(log, signer, c2)

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)

	const branchMergesResult = await log.db.query("$branch_merges", {})
	t.deepEqual(branchMergesResult.length, 1)
	const { id, ...branchMerge } = branchMergesResult[0]
	t.deepEqual(branchMerge, {
		source_branch: 0,
		source_message_id: parent1,
		source_clock: 1,
		target_branch: 1,
		target_message_id: child2,
		target_clock: 2,
	})
})

testPlatforms("branch (P1 -> C1, P1 -> C2, P2 -> C2)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await insert(log, signer, p1)

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await insert(log, signer, p2)

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await insert(log, signer, c1)

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child2 } = await insert(log, signer, c2)

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)

	const branchMergesResult = await log.db.query("$branch_merges", {})
	t.deepEqual(branchMergesResult.length, 1)
	const { id, ...branchMerge } = branchMergesResult[0]
	t.deepEqual(branchMerge, {
		source_branch: 0,
		source_message_id: parent1,
		source_clock: 1,
		target_branch: 1,
		target_message_id: child2,
		target_clock: 2,
	})
})

testPlatforms("branch (P1 -> C1, P1 -> C2, P2 -> C2, P1 -> C3, P2 -> C3)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })
	const signer = ed25519.create()

	const p1 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent1 } = await insert(log, signer, p1)

	const p2 = { topic, clock: 1, parents: [], payload: nanoid() }
	const { id: parent2 } = await insert(log, signer, p2)

	const c1 = { topic, clock: 2, parents: [parent1], payload: nanoid() }
	const { id: child1 } = await insert(log, signer, c1)

	const c2 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child2 } = await insert(log, signer, c2)

	const c3 = { topic, clock: 2, parents: [parent1, parent2], payload: nanoid() }
	const { id: child3 } = await insert(log, signer, c3)

	t.deepEqual((await log.db.get("$messages", parent1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", parent2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", child2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", child3))!.branch, 2)

	t.deepEqual((await log.db.query("$branch_merges", {})).length, 3)

	const res1 = await log.db.query("$branch_merges", { where: { source_branch: 0, target_branch: 1 } })
	const { id: _id1, ...branchMerge1 } = res1[0]
	t.deepEqual(branchMerge1, {
		source_branch: 0,
		source_message_id: parent1,
		source_clock: 1,
		target_branch: 1,
		target_message_id: child2,
		target_clock: 2,
	})

	const res2 = await log.db.query("$branch_merges", { where: { source_branch: 0, target_branch: 2 } })
	const { id: _id2, ...branchMerge2 } = res2[0]
	t.deepEqual(branchMerge2, {
		source_branch: 0,
		source_message_id: parent1,
		source_clock: 1,
		target_branch: 2,
		target_message_id: child3,
		target_clock: 2,
	})

	const res3 = await log.db.query("$branch_merges", { where: { source_branch: 1, target_branch: 2 } })
	const { id: _id3, ...branchMerge3 } = res3[0]
	t.deepEqual(branchMerge3, {
		source_branch: 1,
		source_message_id: parent2,
		source_clock: 1,
		target_branch: 2,
		target_message_id: child3,
		target_clock: 2,
	})
})

testPlatforms("branch where parents have different clock values", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply })
	const signer = ed25519.create()

	const { id: a1 } = await insert(log, signer, { topic, clock: 1, parents: [], payload: nanoid() })
	const { id: a2 } = await insert(log, signer, { topic, clock: 1, parents: [], payload: nanoid() })

	const { id: b1 } = await insert(log, signer, { topic, clock: 2, parents: [a1], payload: nanoid() })
	const { id: b2 } = await insert(log, signer, { topic, clock: 2, parents: [a1, a2], payload: nanoid() })

	const { id: c1 } = await insert(log, signer, { topic, clock: 3, parents: [b1, a2], payload: nanoid() })

	t.deepEqual((await log.db.get("$messages", a1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", a2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", b1))!.branch, 0)
	t.deepEqual((await log.db.get("$messages", b2))!.branch, 1)
	t.deepEqual((await log.db.get("$messages", c1))!.branch, 2)

	// t.deepEqual((await log.db.query("$branch_merges", {})).length, 3)

	// const res1 = await log.db.query("$branch_merges", { where: { source_branch: 0, target_branch: 1 } })
	// const { id: _id1, ...branchMerge1 } = res1[0]
	// t.deepEqual(branchMerge1, {
	// 	source_branch: 0,
	// 	source_message_id: parent1,
	// 	source_clock: 1,
	// 	target_branch: 1,
	// 	target_message_id: child2,
	// 	target_clock: 2,
	// })
})
