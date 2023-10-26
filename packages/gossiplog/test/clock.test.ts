import test from "ava"

import { encodeClock, decodeClock, encodingLength } from "@canvas-js/gossiplog"

test("test clock encoding", (t) => {
	const max = 100_000
	const key = new Uint8Array(encodingLength(max))

	const a = new Uint8Array(4)

	for (let clock = 0; clock < max; clock++) {
		const len = encodeClock(key, clock)
		t.deepEqual(decodeClock(key), [clock, len])
	}
})
