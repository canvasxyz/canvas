import test from "ava"
import { randomUUID } from "crypto"

import { GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/memory"

import { createNetwork, waitForGraft, waitForInitialConnections, waitForInitialSync } from "./libp2p.js"

test("wait for initial connection events", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => GossipLog.open({ topic, apply }), {
		a: { port: 9990 },
		b: { port: 9991, peers: ["a"] },
	})

	await t.notThrowsAsync(() => waitForInitialConnections(network))
})

test("wait for initial graft events", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => GossipLog.open({ topic, apply }), {
		a: { port: 9990 },
		b: { port: 9991, peers: ["a"] },
	})

	await t.notThrowsAsync(() => waitForGraft(network, [["a", "b"]]))
})

test("wait for initial sync events", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => GossipLog.open({ topic, apply }), {
		a: { port: 9990 },
		b: { port: 9991, peers: ["a"] },
	})

	await t.notThrowsAsync(() => waitForInitialSync(network, [["a", "b"]]))
})
