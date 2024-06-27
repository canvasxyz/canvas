import test from "ava"
import crypto from "node:crypto"

import { compare } from "uint8arrays"

import { KEY_LENGTH, decodeId, encodeClock } from "@canvas-js/gossiplog"

test("sort 10000 random keys", async (t) => {
	const n = 10000
	const keys: Uint8Array[] = new Array(n)
	const ids: string[] = new Array(n)
	for (let i = 0; i < n; i++) {
		keys[i] = crypto.getRandomValues(new Uint8Array(KEY_LENGTH))
		ids[i] = decodeId(keys[i])
	}

	keys.sort(compare)
	ids.sort((a, b) => (a < b ? -1 : b < a ? 1 : 0))

	for (let i = 0; i < n; i++) {
		t.is(decodeId(keys[i]), ids[i])
	}
})

test("sort 20000 random message IDs", async (t) => {
	const n = 20000
	const keys: Uint8Array[] = new Array(n)
	const ids: string[] = new Array(n)
	for (let i = 0; i < n; i++) {
		keys[i] = new Uint8Array(KEY_LENGTH)
		const encodingLength = encodeClock(keys[i], i)
		crypto.getRandomValues(keys[i].subarray(encodingLength))
		ids[i] = decodeId(keys[i])
	}

	for (let i = 0; i < n - 1; i++) {
		t.is(compare(keys[i], keys[i + 1]), -1)
		t.true(ids[i] < ids[i + 1])
	}
})
