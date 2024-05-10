// import test from "ava"

// import type { Signature, Message } from "@canvas-js/interfaces"

// import { GossipLog } from "@canvas-js/gossiplog/memory"

// import { createNetwork, waitForInitialSync } from "./libp2p.js"

// test("wait for initial sync", async (t) => {
// 	t.timeout(20 * 1000)
// 	const network = await createNetwork(t, {
// 		a: { port: 9990, peers: ["b"] },
// 		b: { port: 9991, peers: ["a"] },
// 	})

// 	const topic = "com.example.test"
// 	const apply = async (id: string, signature: Signature, message: Message<string>) => {}
// 	const validate = (payload: unknown): payload is string => typeof payload === "string"

// 	const messageLogs = {
// 		a: await GossipLog.open({ topic, apply }),
// 		b: await GossipLog.open({ topic, apply }),
// 	}

// 	await Promise.all([
// 		network.a.services.gossiplog.subscribe(messageLogs.a),
// 		network.b.services.gossiplog.subscribe(messageLogs.b),
// 	])

// 	await t.notThrowsAsync(() => waitForInitialSync(network))
// })
