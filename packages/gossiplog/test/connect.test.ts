import test from "ava"

import { Signature } from "@canvas-js/signed-cid"
import { Message } from "@canvas-js/interfaces"

import { createNetwork, waitForInitialConnections, waitForInitialSync } from "./libp2p.js"

test("wait for initial connections", async (t) => {
	t.timeout(10 * 1000)

	const network = await createNetwork(t, {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	})

	await waitForInitialConnections(network)

	t.pass()
})

test("wait for initial sync", async (t) => {
	t.timeout(20 * 1000)
	const network = await createNetwork(t, {
		a: { port: 9992, peers: ["b"] },
		b: { port: 9993, peers: ["a"] },
	})

	const topic = "com.example.test"
	const apply = async (id: string, signature: Signature | null, message: Message<string>) => {}
	const validate = (payload: unknown): payload is string => typeof payload === "string"

	await Promise.all([
		network.a.services.gossiplog.subscribe({ topic, apply, validate }),
		network.b.services.gossiplog.subscribe({ topic, apply, validate }),
	])

	await waitForInitialSync(network)

	t.pass()
})
