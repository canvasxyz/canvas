import test from "ava"

import { ed25519 } from "@noble/curves/ed25519"
import { IPLDValue } from "@canvas-js/interfaces"
import { createSignature } from "@canvas-js/signed-cid"

import type { GossipLog, GossipLogInit } from "@canvas-js/libp2p-gossiplog"

import { NetworkInit, createNetwork } from "./libp2p.js"

test("send messages", async (t) => {
	const privateKey = ed25519.utils.randomPrivateKey()

	const messages: IPLDValue[] = []

	const init: GossipLogInit = {
		location: null,
		topic: "test:example",
		apply: (key, signature, message) => {
			messages.push({ key, signature, message })
			return { result: undefined }
		},
	}

	const network: NetworkInit = {
		a: { port: 9992, peers: ["b"], logs: { example: init } },
		b: { port: 9993, peers: ["a"], logs: { example: init } },
	}

	const peers = await createNetwork<{ example: GossipLog<IPLDValue> }>(t, network)

	const message = await peers.a.services.example.create({ foo: "bar" })
	const signature = createSignature("ed25519", privateKey, message)

	const { key, result } = await peers.a.services.example.publish(signature, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ key, signature, message }])
})
