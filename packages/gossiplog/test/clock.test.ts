import test from "ava"

import { encodeClock, decodeClock, encodingLength } from "@canvas-js/gossiplog"

test("test clock encoding", (t) => {
	const max = 1_000_000n
	const key = new Uint8Array(encodingLength(max))

	for (let clock = 0n; clock < max; clock++) {
		const len = encodeClock(key, clock)
		t.deepEqual(decodeClock(key), [clock, len])
	}
})
