import test from "ava"

import { GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/memory"

import { createNetwork, waitForInitialConnections } from "./libp2p.js"
import { randomUUID } from "crypto"

test("wait for initial connections", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => GossipLog.open({ topic, apply }), {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	})

	await t.notThrowsAsync(() => waitForInitialConnections(network))
})
