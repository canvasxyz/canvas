import test from "ava"
import crypto from "node:crypto"

import { KEY_LENGTH, decodeId } from "@canvas-js/gossiplog"
import { lessThan } from "@canvas-js/okra"

test("sort 10000 random keys", async (t) => {
	const n = 10000
	const keys = new Array(n)
	const ids = new Array(n)
	for (let i = 0; i < n; i++) {
		keys[i] = crypto.getRandomValues(new Uint8Array(KEY_LENGTH))
		ids[i] = decodeId(keys[i])
	}

	keys.sort((a, b) => (lessThan(a, b) ? -1 : lessThan(b, a) ? 1 : 0))
	ids.sort((a, b) => (a < b ? -1 : b < a ? 1 : 0))

	for (let i = 0; i < n; i++) {
		t.is(decodeId(keys[i]), ids[i])
	}
})
