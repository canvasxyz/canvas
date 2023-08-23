import test, { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { IPLDValue } from "@canvas-js/interfaces"
import type { GossipLog, GossipLogInit } from "@canvas-js/libp2p-gossiplog"

import { NetworkInit, createNetwork } from "./libp2p.js"

async function connectAndSync(t: ExecutionContext<unknown>, init: GossipLogInit) {
	const network: NetworkInit = {
		a: { port: 9990, peers: ["b"], logs: { example: init } },
		b: { port: 9991, peers: ["a"], logs: { example: init } },
	}

	const peers = await createNetwork<{ example: GossipLog<IPLDValue> }>(t, network, { start: false })

	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const source of Object.values(peers)) {
		const sourceId = source.peerId
		for (const target of Object.values(peers)) {
			const targetId = target.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		source.services.example.addEventListener("sync", ({ detail: { peerId: targetId } }) => {
			console.log("[%s] sync completed with peer %s", sourceId, targetId)
			syncPromises[`${sourceId}:${targetId}`].resolve()
		})
	}

	t.teardown(() => Object.values(peers).map((peer) => peer.stop()))

	await Promise.all([
		...Object.values(peers).map((peer) => peer.start()),
		...Object.values(syncPromises).map((defer) => defer.promise),
	])
}

test("sync empty in-memory logs", async (t) => {
	const init: GossipLogInit = {
		location: null,
		topic: "test:example",
		apply: (message) => {
			console.log("applying", message)
			return { result: undefined }
		},
	}

	await connectAndSync(t, init)
	t.pass()
})
