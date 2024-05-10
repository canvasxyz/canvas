// import test from "ava"

// import { createNetwork, waitForInitialConnections } from "./libp2p.js"

// test("wait for initial connections", async (t) => {
// 	t.timeout(10 * 1000)

// 	const network = await createNetwork(t, {
// 		a: { port: 9990, peers: ["b"] },
// 		b: { port: 9991, peers: ["a"] },
// 	})

// 	await t.notThrowsAsync(() => waitForInitialConnections(network))
// })
