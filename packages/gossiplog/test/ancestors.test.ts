import assert from "node:assert"

import { nanoid } from "nanoid"
import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { AbstractGossipLog, Ed25519Signer, decodeId } from "@canvas-js/gossiplog"
import { appendChain, shuffle, testPlatforms } from "./utils.js"

const topic = "com.example.test"
const apply = (id: string, signature: Signature, message: Message<string>) => {}
const validate = (payload: unknown): payload is string => true

// testPlatforms("get ancestors (append, linear history)", async (t, openGossipLog) => {
// 	const log = await openGossipLog(t, { topic, apply, validate, indexAncestors: true })

// 	const n = 20
// 	const ids: string[] = []
// 	for (let i = 0; i < n; i++) {
// 		const { id } = await log.append(nanoid())
// 		ids.push(id)
// 	}

// 	for (let i = 0; i < n; i++) {
// 		for (let j = 0; j < i; j++) {
// 			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
// 		}
// 	}
// })

// testPlatforms("get ancestors (insert, linear history)", async (t, openGossipLog) => {
// 	const signer = new Ed25519Signer()
// 	const log = await openGossipLog(t, { topic, apply, validate, indexAncestors: true })

// 	const n = 20
// 	const ids: string[] = []
// 	for (let i = 0; i < n; i++) {
// 		const message: Message<string> = {
// 			topic,
// 			clock: i + 1,
// 			parents: i === 0 ? [] : [ids[i - 1]],
// 			payload: nanoid(),
// 		}

// 		const signature = signer.sign(message)
// 		const { id } = await log.insert(signature, message)
// 		ids.push(id)
// 	}

// 	for (let i = 0; i < n; i++) {
// 		for (let j = 0; j < i; j++) {
// 			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
// 		}
// 	}
// })

// testPlatforms("get ancestors (insert, linear history, shuffled)", async (t, openGossipLog) => {
// 	const signer = new Ed25519Signer()
// 	const log = await openGossipLog(t, { topic, apply, validate, indexAncestors: true })

// 	const n = 20
// 	const ids: string[] = []
// 	const messages: [Signature, Message<string>][] = []
// 	for (let i = 0; i < n; i++) {
// 		const message: Message<string> = {
// 			topic,
// 			clock: i + 1,
// 			parents: i === 0 ? [] : [ids[i - 1]],
// 			payload: nanoid(),
// 		}

// 		const signature = signer.sign(message)
// 		messages.push([signature, message])
// 		const [key] = log.encode(signature, message)
// 		ids.push(decodeId(key))
// 	}

// 	shuffle(messages)
// 	for (const [signature, message] of messages) {
// 		await log.insert(signature, message)
// 	}

// 	for (let i = 0; i < n; i++) {
// 		for (let j = 0; j < i; j++) {
// 			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
// 		}
// 	}
// })

// testPlatforms("get ancestors (insert, concurrent history, fixed)", async (t, openGossipLog) => {
// 	const log = await openGossipLog(t, { topic, apply, validate, indexAncestors: true })

// 	const { id: idX } = await log.append(nanoid())
// 	const { id: idY } = await log.append(nanoid())
// 	const { id: idZ } = await log.append(nanoid())
// 	const chainA = await appendChain(log, idZ, 5)
// 	const chainB = await appendChain(log, idZ, 3)
// 	const { id: tailId } = await log.append(nanoid())

// 	t.deepEqual(await log.getAncestors(idZ, 1), [idX])
// 	t.deepEqual(await log.getAncestors(tailId, 1), [idX])
// 	t.deepEqual(await log.getAncestors(tailId, 3), [idZ])
// 	t.deepEqual(await log.getAncestors(chainA[0], 3), [idZ])
// 	t.deepEqual(await log.getAncestors(chainB[0], 3), [idZ])

// 	t.deepEqual(await log.getAncestors(tailId, 4), [chainA[0], chainB[0]].sort())
// 	t.deepEqual(await log.getAncestors(tailId, 5), [chainA[1], chainB[1]].sort())
// 	t.deepEqual(await log.getAncestors(tailId, 6), [chainA[2], chainB[2]].sort())

// 	t.deepEqual(await log.getAncestors(tailId, 7), [chainA[3], chainB[2]].sort())
// 	t.deepEqual(await log.getAncestors(chainA[4], 7), [chainA[3]])

// 	t.deepEqual(await log.getAncestors(chainA[2], 4), [chainA[0]])
// 	t.deepEqual(await log.getAncestors(chainB[2], 4), [chainB[0]])
// })

testPlatforms("simulate a randomly partitioned network", async (t, openGossipLog) => {
	t.timeout(30 * 1000)
	const logs = await Promise.all([
		openGossipLog(t, { topic, apply, validate, indexAncestors: true }),
		openGossipLog(t, { topic, apply, validate, indexAncestors: true }),
		openGossipLog(t, { topic, apply, validate, indexAncestors: true }),
		// openGossipLog(t, { topic, apply, validate, indexAncestors: true }),
		// openGossipLog(t, { topic, apply, validate, indexAncestors: true }),
	])

	const random = (n: number) => Math.floor(Math.random() * n)

	// const MESSAGE_COUNT = 2048
	// const MAX_CHAIN_LENGTH = 6
	const MESSAGE_COUNT = 128
	const MAX_CHAIN_LENGTH = 4

	const messageIDs: string[] = []
	const messageIndices = new Map<string, { index: number; map: Uint8Array }>()

	const bitMaps = logs.map(() => new Uint8Array(MESSAGE_COUNT / 8))

	const setBit = (map: Uint8Array, i: number) => {
		const bit = i % 8
		const index = (i - bit) / 8
		map[index] = map[index] | (1 << bit)
	}

	const getBit = (map: Uint8Array, i: number): boolean => {
		const bit = i % 8
		const index = (i - bit) / 8
		return Boolean(map[index] & (1 << bit))
	}

	const merge = (self: Uint8Array, peer: Uint8Array) => {
		for (let i = 0; i < MESSAGE_COUNT / 8; i++) {
			self[i] |= peer[i]
		}
	}

	const start = performance.now()
	let messageCount = 0
	while (messageCount < MESSAGE_COUNT) {
		const selfIndex = random(logs.length)
		const self = logs[selfIndex]

		// sync with a random peer
		const peerIndex = random(logs.length)
		if (peerIndex !== selfIndex) {
			const peer = logs[peerIndex]
			await peer.serve(async (source) => {
				await self.sync(source)
			})

			merge(bitMaps[selfIndex], bitMaps[peerIndex])
		}

		// append a chain of messages
		const chainLength = random(MAX_CHAIN_LENGTH)
		for (let j = 0; j < chainLength && messageCount < MESSAGE_COUNT; j++) {
			const { id } = await self.append(nanoid())
			const index = messageCount++
			messageIndices.set(id, { index, map: new Uint8Array(bitMaps[selfIndex]) })
			messageIDs.push(id)
			setBit(bitMaps[selfIndex], index)
		}
	}

	// for (const [i, log] of logs.entries()) {
	// 	const map = bitMaps[i]
	// 	for (let j = 0; j < MESSAGE_COUNT; j++) {
	// 		const id = messageIDs[j]

	// 		const [signature, message] = await log.get(id)
	// 		if (getBit(map, j)) {
	// 			t.assert(signature !== null)
	// 			t.assert(message !== null)
	// 		} else {
	// 			t.is(signature, null)
	// 			t.is(message, null)
	// 		}
	// 	}
	// }

	const time = performance.now() - start
	t.log("created a randomly partitioned network with", messageCount, "total messages in", time.toPrecision(3), "ms")

	// we don't need messages to be sorted in index order anymore;
	// the indexes are just for indexing bitMaps now.
	messageIDs.sort()

	let sum: number = 0
	let n: number = 0

	const [self, ...peers] = logs
	for (const peer of peers) {
		await peer.serve(async (source) => {
			await self.sync(source)
		})
	}

	for (const id of messageIDs) {
		const { map } = messageIndices.get(id)!

		for (const ancestorID of messageIDs) {
			if (ancestorID === id) {
				break
			}

			const start = performance.now()
			const isAncestor = await self.isAncestor(id, ancestorID)
			sum += performance.now() - start
			n++

			const { index: ancestorIndex } = messageIndices.get(ancestorID)!
			t.is(isAncestor, getBit(map, ancestorIndex))
		}
	}

	t.log("completed", n, "isAncestor queries with an average of", (sum / n).toPrecision(3), "ms per query")
})
