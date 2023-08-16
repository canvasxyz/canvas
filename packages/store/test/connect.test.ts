import test from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import type { AbstractStore } from "@canvas-js/store"
import { openStore } from "@canvas-js/store/memory"

import { NetworkInit, createNetwork } from "./libp2p.js"
import { printNode } from "./utils.js"

test("sync empty memory stores", async (t) => {
	const network: NetworkInit = {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	}

	const peers = await createNetwork(network, { start: false })

	const topic = "test:example"

	const stores: Record<string, AbstractStore> = await Promise.all(
		Object.entries(peers).map(async ([name, peer]) => {
			const store = await openStore({ libp2p: peer, topic, apply: (key, event) => ({}) })
			return [name, store]
		})
	).then((entries) => Object.fromEntries(entries))

	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const store of Object.values(stores)) {
		const sourceId = store.libp2p.peerId
		for (const peer of Object.values(peers)) {
			const targetId = peer.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		store.addEventListener("sync", ({ detail: { peerId: targetId, root } }) => {
			console.log("[%s] sync completed with peer %s, root %s", sourceId, targetId, printNode(root))
			syncPromises[`${sourceId}:${targetId}`].resolve()
		})
	}

	await Promise.all([
		...Object.values(stores).map((store) => store.start()),
		...Object.values(syncPromises).map((defer) => defer.promise),
	])

	t.pass()
})
