import test from "ava"

import { ed25519 } from "@noble/curves/ed25519"
import { IPLDValue } from "@canvas-js/interfaces"
import { createSignature } from "@canvas-js/signed-cid"

import { GossipLog, GossipLogInit } from "@canvas-js/gossiplog"

import { NetworkInit, createNetwork } from "./libp2p.js"

test("send messages", async (t) => {
	const privateKey = ed25519.utils.randomPrivateKey()

	const messages: IPLDValue[] = []

	const init: GossipLogInit = {
		location: null,
		topic: "com.example.test",
		apply: (key, signature, message) => {
			messages.push({ key, signature, message })
			return { result: undefined }
		},
	}

	const network: NetworkInit = {
		a: { port: 9992, peers: ["b"] },
		b: { port: 9993, peers: ["a"] },
	}

	const peers = await createNetwork(t, network)
	const logs = await Promise.all(
		Object.entries(peers).map(([name, peer]) =>
			GossipLog.init(peer, init).then((log) => [name, log] satisfies [string, GossipLog])
		)
	).then((entries) => Object.fromEntries(entries))

	const message = await logs.a.create({ foo: "bar" })
	const signature = createSignature("ed25519", privateKey, message)

	const { key, result } = await logs.a.publish(signature, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ key, signature, message }])
})
