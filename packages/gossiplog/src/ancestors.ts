import * as cbor from "@ipld/dag-cbor"

import { Awaitable } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"
import { decodeClock } from "./clock.js"
import { decodeId, encodeId } from "./schema.js"
import { equals } from "uint8arrays"
import { getAncestorClocks } from "./utils.js"

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

export async function isAncestor(
	ancestors: { get: (key: Uint8Array) => Awaitable<Uint8Array | null> },
	key: Uint8Array,
	ancestorKey: Uint8Array,
	visited = new Set<string>(),
): Promise<boolean> {
	if (equals(key, ancestorKey)) {
		return true
	}

	const [clock] = decodeClock(key)
	const [ancestorClock] = decodeClock(ancestorKey)

	if (clock <= ancestorClock) {
		return false
	}

	const index = Math.floor(Math.log2(clock - ancestorClock))
	const value = await ancestors.get(key)
	assert(value !== null, "key not found in ancestor index")

	const links = cbor.decode<Uint8Array[][]>(value)
	for (const key of links[index]) {
		const id = decodeId(key)

		if (visited.has(id)) {
			continue
		}

		visited.add(id)
		const result = await isAncestor(ancestors, key, ancestorKey, visited)
		if (result) {
			return true
		}
	}

	return false
}

export async function indexAncestors(
	ancestors: {
		get: (key: Uint8Array) => Awaitable<Uint8Array | null>
		set: (key: Uint8Array, value: Uint8Array) => Awaitable<void>
	},
	key: Uint8Array,
	parentKeys: Uint8Array[],
) {
	const [clock] = decodeClock(key)
	const ancestorClocks = Array.from(getAncestorClocks(clock))
	const ancestorLinks: Uint8Array[][] = new Array(ancestorClocks.length)

	for (const [i, ancestorClock] of ancestorClocks.entries()) {
		if (i === 0) {
			ancestorLinks[i] = parentKeys
		} else {
			const links = new Set<string>()
			for (const child of ancestorLinks[i - 1]) {
				const [childClock] = decodeClock(child)
				if (childClock <= ancestorClock) {
					links.add(decodeId(child))
				} else {
					assert(childClock <= ancestorClocks[i - 1], "expected childClock <= ancestorClocks[i - 1]")
					await getAncestors(ancestors, child, ancestorClock, links)
				}
			}

			ancestorLinks[i] = Array.from(links).map(encodeId).sort()
		}
	}

	await ancestors.set(key, cbor.encode(ancestorLinks))
}
