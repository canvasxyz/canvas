import test from "ava"

import { GossipLogInit } from "@canvas-js/gossiplog"

import { createNetwork, waitForInitialConnections, waitForInitialSync } from "./libp2p.js"

test("wait for initial connections", async (t) => {
	const init: GossipLogInit = { topic: "com.example.test", apply: () => ({ result: undefined }) }

	const network = await createNetwork(t, {
		a: { port: 9990, peers: ["b"], init },
		b: { port: 9991, peers: ["a"], init },
	})

	await waitForInitialConnections(network)

	t.pass()
})

test("wait for initial sync", async (t) => {
	const init: GossipLogInit = { topic: "com.example.test", apply: () => ({ result: undefined }) }

	const network = await createNetwork(t, {
		a: { port: 9992, peers: ["b"], init },
		b: { port: 9993, peers: ["a"], init },
	})

	await waitForInitialSync(network)

	t.pass()
})
