import Prando from "prando"

import test, { ExecutionContext } from "ava"

import { ed25519 } from "@canvas-js/signatures"
import { AbstractGossipLog, GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

import { getDirectory } from "./utils.js"
import { toString } from "uint8arrays"

const rng = new Prando.default()

const random = (n: number) => rng.nextInt(0, n - 1)
const pseudoRandomBytes = (length: number) => new Uint8Array(length).map(() => rng.nextInt(0, 255))
const pseudoRandomEd25519 = () => ed25519.create({ type: "ed25519", privateKey: pseudoRandomBytes(32) })

const apply: GossipLogConsumer<string> = ({}) => {}

test("simulate a randomly partitioned network, logs on disk", async (t) => {
	t.timeout(60 * 1000)
	const topic = "app.example.com"

	const logs: AbstractGossipLog<string>[] = await Promise.all([
		GossipLog.open(getDirectory(t), { topic, apply }),
		GossipLog.open(getDirectory(t), { topic, apply }),
		GossipLog.open(getDirectory(t), { topic, apply }),
	])

	// const maxMessageCount = 2048
	// const maxChainLength = 6
	const maxMessageCount = 256
	const maxChainLength = 5
	await simulateRandomNetwork(t, logs, maxMessageCount, maxChainLength)
})

export const simulateRandomNetwork = async (
	t: ExecutionContext<unknown>,
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

	const start = performance.now()
	let messageCount = 0
	while (messageCount < maxMessageCount) {
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
			const { id } = await self.append(toString(pseudoRandomBytes(8)), { signer: signers[selfIndex] })
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

			const signedMessage = await log.get(id)
			if (getBit(map, j)) {
				t.assert(signedMessage !== null)
			} else {
				t.is(signedMessage, null, "missing message")
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
			t.is(isAncestor, getBit(map, ancestorIndex), "inconsistent isAncestor result")
		}
	}

	t.log("completed", n, "isAncestor queries with an average of", (sum / n).toPrecision(3), "ms per query")

	for (const log of logs) {
		await log.close()
	}
}
