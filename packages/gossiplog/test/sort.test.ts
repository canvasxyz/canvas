import test from "ava"
import crypto from "node:crypto"

import { compare } from "uint8arrays"

import { KEY_LENGTH, decodeId } from "@canvas-js/gossiplog"

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
