import * as cbor from "@ipld/dag-cbor"

import { Awaitable } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"
import { decodeClock } from "./clock.js"
import { decodeId } from "./schema.js"

export async function getAncestors(
	txn: { get(key: Uint8Array): Awaitable<Uint8Array | null> },
	key: Uint8Array,
	atOrBefore: number,
	results = new Set<string>(),
	visited = new Set<string>(),
): Promise<void> {
	assert(atOrBefore > 0, "expected atOrBefore > 0")

	const [clock] = decodeClock(key)
	assert(atOrBefore < clock, "expected atOrBefore < clock")

	const index = Math.floor(Math.log2(clock - atOrBefore))
	const value = await txn.get(key)
	if (value === null) {
		throw new Error(`key ${decodeId(key)} not found in ancestor index`)
	}

	const links = cbor.decode<Uint8Array[][]>(value)
	for (const ancestorKey of links[index]) {
		const [ancestorClock] = decodeClock(ancestorKey)
		const ancestorId = decodeId(ancestorKey)

		if (ancestorClock <= atOrBefore) {
			results.add(ancestorId)
		} else if (visited.has(ancestorId)) {
			break
		} else {
			visited.add(ancestorId)
			await getAncestors(txn, ancestorKey, atOrBefore, results, visited)
		}
	}
}
