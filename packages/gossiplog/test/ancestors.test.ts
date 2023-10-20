import { nanoid } from "nanoid"
import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { decodeId } from "@canvas-js/gossiplog"
import { appendChain, collect, shuffle, testPlatforms } from "./utils.js"

const topic = "com.example.test"
const apply = (id: string, signature: Signature | null, message: Message<string>) => {}
const validate = (payload: unknown): payload is string => true

testPlatforms("append messages", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, indexAncestors: true })

	const [a, b, c] = [nanoid(), nanoid(), nanoid()]
	const { id: idA } = await log.append(a, {})
	const { id: idB } = await log.append(b, {})
	const { id: idC } = await log.append(c, {})

	t.deepEqual(await collect(log.iterate()), [
		[idA, null, { topic, clock: 1, parents: [], payload: a }],
		[idB, null, { topic, clock: 2, parents: [idA], payload: b }],
		[idC, null, { topic, clock: 3, parents: [idB], payload: c }],
	])
})

testPlatforms("get ancestors (append, linear history)", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const { id } = await log.append(nanoid())
		ids.push(id)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}
})

testPlatforms("get ancestors (insert, linear history)", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const { id } = await log.insert(null, {
			topic,
			clock: i + 1,
			parents: i === 0 ? [] : [ids[i - 1]],
			payload: nanoid(),
		})

		ids.push(id)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}
})

testPlatforms("get ancestors (insert, linear history, shuffled)", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	const messages: Message<string>[] = []
	for (let i = 0; i < n; i++) {
		messages.push({
			topic,
			clock: i + 1,
			parents: i === 0 ? [] : [ids[i - 1]],
			payload: nanoid(),
		})

		const [key] = log.encode(null, messages[i])
		ids.push(decodeId(key))
	}

	shuffle(messages)
	for (const message of messages) {
		const { id } = await log.insert(null, message)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}
})

testPlatforms("get ancestors (insert, concurrent history, fixed)", async (t, openGossipLog) => {
	const log = await openGossipLog(t, { topic, apply, validate, signatures: false, indexAncestors: true })

	const { id: idX } = await log.append(nanoid())
	const { id: idY } = await log.append(nanoid())
	const { id: idZ } = await log.append(nanoid())
	const chainA = await appendChain(log, idZ, 5)
	const chainB = await appendChain(log, idZ, 3)
	const { id: tailId } = await log.append(nanoid())

	t.deepEqual(await log.getAncestors(idZ, 1), [idX])
	t.deepEqual(await log.getAncestors(tailId, 1), [idX])
	t.deepEqual(await log.getAncestors(tailId, 3), [idZ])
	t.deepEqual(await log.getAncestors(chainA[0], 3), [idZ])
	t.deepEqual(await log.getAncestors(chainB[0], 3), [idZ])

	t.deepEqual(await log.getAncestors(tailId, 4), [chainA[0], chainB[0]].sort())
	t.deepEqual(await log.getAncestors(tailId, 5), [chainA[1], chainB[1]].sort())
	t.deepEqual(await log.getAncestors(tailId, 6), [chainA[2], chainB[2]].sort())

	t.deepEqual(await log.getAncestors(tailId, 7), [chainA[3], chainB[2]].sort())
	t.deepEqual(await log.getAncestors(chainA[4], 7), [chainA[3]])

	t.deepEqual(await log.getAncestors(chainA[2], 4), [chainA[0]])
	t.deepEqual(await log.getAncestors(chainB[2], 4), [chainB[0]])
})
