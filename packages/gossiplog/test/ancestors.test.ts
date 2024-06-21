import Prando from "prando"

import test, { ExecutionContext } from "ava"
import { customRandom, urlAlphabet } from "nanoid"

import type { Message } from "@canvas-js/interfaces"
import { ed25519 } from "@canvas-js/signatures"
import { AbstractGossipLog, GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/sqlite"
// import { GossipLog as PostgresGossipLog } from "@canvas-js/gossiplog/pg"

import { appendChain, getDirectory, testPlatforms } from "./utils.js"

const rng = new Prando.default("seed784142")

const random = (n: number) => rng.nextInt(0, n - 1)

const nanoid = customRandom(urlAlphabet, 10, (size) => {
	return new Uint8Array(size).map(() => rng.nextInt(0, 255))
})

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms("get ancestors (append, linear history)", async (t, openGossipLog) => {
	const topic = nanoid()
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
})

testPlatforms("get ancestors (insert, linear history)", async (t, openGossipLog) => {
	const topic = nanoid()
	const signer = ed25519.create()
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
		const { id } = await log.insert(log.encode(signature, message))
		ids.push(id)
	}

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < i; j++) {
			t.deepEqual(await log.getAncestors(ids[i], j + 1), [ids[j]], `i=${i} j=${j}`)
		}
	}
})

testPlatforms("get ancestors (insert, concurrent history, fixed)", async (t, openGossipLog) => {
	const topic = nanoid()
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
})

test("simulate a randomly partitioned network, logs on disk", async (t) => {
	t.timeout(30 * 1000)
	const topic = nanoid()

	const logs: AbstractGossipLog<string>[] = [
		new GossipLog({ directory: getDirectory(t), topic, apply, indexAncestors: true }),
		new GossipLog({ directory: getDirectory(t), topic, apply, indexAncestors: true }),
		new GossipLog({ directory: getDirectory(t), topic, apply, indexAncestors: true }),
	]

	// const maxMessageCount = 2048
	// const maxChainLength = 6
	const maxMessageCount = 32
	const maxChainLength = 2
	await simulateRandomNetwork(t, topic, logs, maxMessageCount, maxChainLength)
})

// test("simulate a randomly partitioned network, logs on postgres", async (t) => {
// 	t.timeout(240 * 1000)
// 	const topic = nanoid()

// 	const getPgConfig = (db: string) => {
// 		const { POSTGRES_HOST, POSTGRES_PORT } = process.env
// 		if (POSTGRES_HOST && POSTGRES_PORT) {
// 			return {
// 				user: "postgres",
// 				database: db,
// 				password: "postgres",
// 				port: parseInt(POSTGRES_PORT),
// 				host: POSTGRES_HOST,
// 			}
// 		} else {
// 			return `postgresql://localhost:5432/${db}`
// 		}
// 	}

// 	const logs: AbstractGossipLog<string>[] = await Promise.all([
// 		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test"), true),
// 		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test2"), true),
// 		PostgresGossipLog.open({ topic, apply, indexAncestors: true }, getPgConfig("test3"), true),
// 	])

// 	const maxMessageCount = 128
// 	const maxChainLength = 5
// 	await simulateRandomNetwork(t, topic, logs, maxMessageCount, maxChainLength)
// })

export const simulateRandomNetwork = async (
	t: ExecutionContext<unknown>,
	topic: string,
	logs: AbstractGossipLog<string>[],
	maxMessageCount: number,
	maxChainLength: number,
) => {
	const signers = logs.map(() =>
		ed25519.create({ type: "ed25519", privateKey: new Uint8Array(32).map(() => rng.nextInt(0, 255)) }),
	)

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
			console.log("synced with ", peerIndex)
			const peer = logs[peerIndex]
			await peer.serve((source) => self.sync(source))

			merge(bitMaps[selfIndex], bitMaps[peerIndex])
		}

		// append a chain of messages
		const chainLength = random(maxChainLength)
		for (let j = 0; j < chainLength && messageCount < maxMessageCount; j++) {
			const { id } = await self.append(nanoid(), { signer: signers[selfIndex] })
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
		await peer.serve((source) => self.sync(source))
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
