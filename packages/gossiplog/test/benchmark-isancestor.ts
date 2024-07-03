import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import Prando from "prando"
import { customRandom, nanoid as nanoidRandom } from "nanoid"

import { ed25519 } from "@canvas-js/signatures"
import { AbstractGossipLog, GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

const getDirectory = () => {
	const directory = path.resolve(os.tmpdir(), nanoidRandom())
	fs.mkdirSync(directory)
	return directory
}

const rng = new Prando.default("seed")

const random = (n: number) => rng.nextInt(0, n - 1)

const nanoid = customRandom("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-", 10, (size) => {
	return new Uint8Array(size).map(() => rng.nextInt(0, 255))
})

const pseudoRandomEd25519 = () =>
	ed25519.create({ type: "ed25519", privateKey: new Uint8Array(32).map(() => rng.nextInt(0, 255)) })

const apply: GossipLogConsumer<string> = ({}) => {}

export const simulateRandomNetwork = async (
	topic: string,
	logs: AbstractGossipLog<string>[],
	maxMessageCount: number,
	maxChainLength: number,
) => {
	const signers = logs.map(() => pseudoRandomEd25519())

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

	console.log("creating messages...")
	const start = performance.now()
	let messageCount = 0
	while (messageCount < maxMessageCount) {
		console.log(messageCount)
		const selfIndex = random(logs.length)
		const self = logs[selfIndex]

		// sync with a random peer
		const peerIndex = random(logs.length)
		if (peerIndex !== selfIndex) {
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

	const time = performance.now() - start
	console.log("created a randomly partitioned network with", messageCount, "total messages in", time.toFixed(3), "ms")

	// we don't need messages to be sorted in index order anymore;
	// the indexes are just for indexing bitMaps now.
	messageIDs.sort()

	console.log("syncing...")
	const [self, ...peers] = logs
	for (const peer of peers) {
		await peer.serve((source) => self.sync(source))
	}

	return { messageIDs, messageIndices, getBit }
}

const topic = nanoid()

const logs: AbstractGossipLog<string>[] = [
	new GossipLog({ directory: getDirectory(), topic, apply }),
	new GossipLog({ directory: getDirectory(), topic, apply }),
	new GossipLog({ directory: getDirectory(), topic, apply }),
]

const maxMessageCount = 1024 * 16
const maxChainLength = 5
const clockOffsets = [1, 10, 100, 1000, 10000, 100000, 1000000]

const { messageIDs } = await simulateRandomNetwork(topic, logs, maxMessageCount, maxChainLength)

const timings: Record<string, number[]> = {}
const numSamples = 100
for (let i = 0; i < numSamples; i++) {
	const ancestorRecord = await logs[0].db.query("$messages", { where: { clock: i }, limit: 1 })
	if (ancestorRecord == null) {
		break
	}

	for (const clockOffset of clockOffsets) {
		const messageRecordsWithClock = await logs[0].db.query("$messages", { where: { clock: i + clockOffset }, limit: 1 })
		if (messageRecordsWithClock.length == 0) {
			// no messages with this clock value exist, abort?
			break
		}
		const childRecord = messageRecordsWithClock[0]

		const start = performance.now()
		await logs[0].isAncestor(childRecord.id, messageIDs[0])
		const timingMs = performance.now() - start
		timings[clockOffset] = timings[clockOffset] || []
		timings[clockOffset].push(timingMs)
	}
}

for (const clockOffset of clockOffsets) {
	if (timings[clockOffset]) {
		const avgTiming = timings[clockOffset].reduce((a, b) => a + b, 0) / timings[clockOffset].length
		console.log(`Clock offset ${clockOffset}: ${avgTiming.toFixed(3)}ms, n: ${timings[clockOffset].length} samples`)
	}
}

for (const log of logs) {
	await log.close()
}
