import test, { ExecutionContext } from "ava"

import pDefer, { DeferredPromise } from "p-defer"

import { GossipLog, GossipLogInit } from "@canvas-js/gossiplog"

import { NetworkInit, createNetwork } from "./libp2p.js"

async function connectAndSync(t: ExecutionContext<unknown>, init: GossipLogInit) {
	const network: NetworkInit = {
		a: { port: 9990, peers: ["b"], logs: { example: init } },
		b: { port: 9991, peers: ["a"], logs: { example: init } },
	}

	const peers = await createNetwork(t, network, { start: false })
	const logs = await Promise.all(
		Object.entries(peers).map(([name, peer]) =>
			GossipLog.init(peer, init).then((log) => [name, log] satisfies [string, GossipLog])
		)
	).then((entries) => Object.fromEntries(entries))

	const syncPromises: Record<string, DeferredPromise<void>> = {}

	for (const [name, source] of Object.entries(peers)) {
		const sourceId = source.peerId
		for (const target of Object.values(peers)) {
			const targetId = target.peerId
			if (sourceId.equals(targetId)) {
				continue
			}

			const defer = pDefer<void>()
			syncPromises[`${sourceId}:${targetId}`] = defer
		}

		logs[name].addEventListener("sync", ({ detail: { peerId: targetId } }) => {
			console.log("[%s] sync completed with peer %s", sourceId, targetId)
			syncPromises[`${sourceId}:${targetId}`].resolve()
		})
	}

	t.teardown(() => Object.values(peers).map((peer) => peer.stop()))

	await Promise.all([
		...Object.values(logs).map(async (log) => {
			await log.libp2p?.start()
			await log.start()
		}),
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

		start: false,
	}

	await connectAndSync(t, init)
	t.pass()
})
