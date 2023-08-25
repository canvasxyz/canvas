import test, { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import { GossipLog, GossipLogInit } from "@canvas-js/gossiplog"

import { NetworkInit, createNetwork } from "./libp2p.js"

async function connectAndSync(t: ExecutionContext<unknown>, init: GossipLogInit) {
	const network: NetworkInit = {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	}

	const peers = await createNetwork(t, network)

	const logs = await Promise.all(
		Object.entries(peers).map(([name, peer]) =>
			GossipLog.init(peer, init).then((log) => [name, log] satisfies [string, GossipLog])
		)
	).then((entries) => Object.fromEntries(entries))

	t.teardown(() => Promise.all(Object.values(logs).map((gossipLog) => gossipLog.stop())))

	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const sourceLog of Object.values(logs)) {
		const sourceId = sourceLog.libp2p!.peerId
		for (const target of Object.values(peers)) {
			const targetId = target.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		sourceLog.addEventListener("sync", ({ detail: { peerId: targetId } }) => {
			t.log(`[${sourceId}] sync completed with peer ${targetId}`)
			syncPromises[`${sourceId}:${targetId}`].resolve()
		})
	}

	await Promise.all(Object.values(syncPromises).map((defer) => defer.promise))
}

test("sync empty in-memory logs", async (t) => {
	const init: GossipLogInit = {
		location: null,
		topic: "com.example.test",
		apply: (message) => {
			console.log("applying", message)
			return { result: undefined }
		},
	}

	await connectAndSync(t, init)
	t.pass()
})
