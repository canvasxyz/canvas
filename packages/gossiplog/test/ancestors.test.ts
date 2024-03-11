import { randomUUID } from "node:crypto"

import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import type { Signature, Message } from "@canvas-js/interfaces"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"
import { decodeId } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/node"
import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"
import { AbstractGossipLog } from "@canvas-js/gossiplog"

import { appendChain, getDirectory, shuffle, testPlatforms } from "./utils.js"

const apply = (id: string, signature: Signature, message: Message<string>) => {}

testPlatforms("get ancestors (append, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

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

	await log.close()
})

testPlatforms("get ancestors (insert, linear history)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = new Ed25519DelegateSigner()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	for (let i = 0; i < n; i++) {
		const message: Message<string> = {
			topic,
			clock: i + 1,
			parents: i === 0 ? [] : [ids[i - 1]],
			payload: nanoid(),
		}

		const signature = signer.sign(message)
		const { id } = await log.insert(signature, message)
		ids.push(id)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}

	await log.close()
})

testPlatforms("get ancestors (insert, linear history, shuffled)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const signer = new Ed25519DelegateSigner()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

	const n = 20
	const ids: string[] = []
	const messages: [Signature, Message<string>][] = []
	for (let i = 0; i < n; i++) {
		const message: Message<string> = {
			topic,
			clock: i + 1,
			parents: i === 0 ? [] : [ids[i - 1]],
			payload: nanoid(),
		}

		const signature = signer.sign(message)
		messages.push([signature, message])
		const [key] = log.encode(signature, message)
		ids.push(decodeId(key))
	}

	shuffle(messages)
	for (const [signature, message] of messages) {
		await log.insert(signature, message)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}

	await log.close()
})

testPlatforms("get ancestors (insert, concurrent history, fixed)", async (t, openGossipLog) => {
	const topic = randomUUID()
	const log = await openGossipLog(t, { topic, apply, indexAncestors: true })

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

	await log.close()
})

test("simulate a randomly partitioned network, logs on disk", async (t) => {
	t.timeout(30 * 1000)
	const topic = randomUUID()

	const logs: AbstractGossipLog<string, void>[] = await Promise.all([
		GossipLog.open({ topic, apply, indexAncestors: true }, getDirectory(t)),
		GossipLog.open({ topic, apply, indexAncestors: true }, getDirectory(t)),
		GossipLog.open({ topic, apply, indexAncestors: true }, getDirectory(t)),
	])

	// const maxMessageCount = 2048
	// const maxChainLength = 6
	const maxMessageCount = 256
	const maxChainLength = 5
	await simulateRandomNetwork(t, topic, logs, maxMessageCount, maxChainLength)
})

test("simulate a randomly partitioned network, logs on postgres", async (t) => {
	t.timeout(240 * 1000)
	const topic = randomUUID()

	const getPgConfig = (db: string) =>
		process.env.POSTGRES_HOST && process.env.POSTGRES_PORT
			? {
					user: "postgres",
					database: db,
					password: "postgres",
					port: parseInt(process.env.POSTGRES_PORT, 10),
					host: process.env.POSTGRES_HOST,
				}
			: `postgresql://localhost:5432/${db}`

	const logs: AbstractGossipLog<string, void>[] = await Promise.all([
		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test")),
		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test2")),
		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test3")),
	])

	const maxMessageCount = 128
	const maxChainLength = 5
	await simulateRandomNetwork(t, topic, logs, maxMessageCount, maxChainLength)
})

export const simulateRandomNetwork = async (
	t: ExecutionContext<unknown>,
	topic: string,
	logs: AbstractGossipLog<string, void>[],
	maxMessageCount: number,
	maxChainLength: number,
) => {
	const random = (n: number) => Math.floor(Math.random() * n)

	const messageIDs: string[] = []
	const messageIndices = new Map<string, { index: number; map: Uint8Array }>()

	const bitMaps = logs.map(() => new Uint8Array(maxMessageCount / 8))

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
		for (let i = 0; i < maxMessageCount / 8; i++) {
			self[i] |= peer[i]
		}
	}

	const start = performance.now()
	let messageCount = 0
	while (messageCount < maxMessageCount) {
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
		const chainLength = random(maxChainLength)
		for (let j = 0; j < chainLength && messageCount < maxMessageCount; j++) {
			const { id } = await self.append(nanoid())
			const index = messageCount++
			messageIndices.set(id, { index, map: new Uint8Array(bitMaps[selfIndex]) })
			messageIDs.push(id)
			setBit(bitMaps[selfIndex], index)
		}
	}

	for (const [i, log] of logs.entries()) {
		const map = bitMaps[i]
		for (let j = 0; j < maxMessageCount; j++) {
			const id = messageIDs[j]

			const [signature, message] = await log.get(id)
			if (getBit(map, j)) {
				t.assert(signature !== null)
				t.assert(message !== null)
			} else {
				t.is(signature, null)
				t.is(message, null)
			}
		}
	}

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

	for (const log of logs) {
		await log.close()
	}
}
