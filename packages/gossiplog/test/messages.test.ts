import test from "ava"

import { nanoid } from "nanoid"
import { base32 } from "multiformats/bases/base32"
import { ed25519 } from "@noble/curves/ed25519"

import { createSignature } from "@canvas-js/signed-cid"
import { IPLDValue } from "@canvas-js/interfaces"

import { GossipLog, GossipLogInit } from "@canvas-js/gossiplog"

import { createNetwork, waitForInitialConnections, waitForMessageDelivery } from "./libp2p.js"

const second = 1000

test("apply a signed message offline", async (t) => {
	const messages: IPLDValue[] = []
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages.push({ id, signature, message })
			return { result: undefined }
		},
	})

	const privateKey = ed25519.utils.randomPrivateKey()
	const message = await exampleLog.create("foo")
	const signature = createSignature("ed25519", privateKey, message)
	const { id, result, recipients } = await exampleLog.publish(signature, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, signature, message: { clock: 1, parents: [], payload: "foo" } }])
	t.deepEqual(await recipients, [])
})

test("apply a signed message offline without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages.push({ id, signature, message })
			return { result: undefined }
		},
		sequencing: false,
	})

	const privateKey = ed25519.utils.randomPrivateKey()
	const message = await exampleLog.create("foo")
	const signature = createSignature("ed25519", privateKey, message)
	const { id, result, recipients } = await exampleLog.publish(signature, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, signature, message: { clock: 0, parents: [], payload: "foo" } }])
	t.deepEqual(await recipients, [])
})

test("apply an unsigned message offline", async (t) => {
	const messages: IPLDValue[] = []
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages.push({ id, signature, message })
			return { result: undefined }
		},
		signatures: false,
	})

	const message = await exampleLog.create("foo")
	const { id, result, recipients } = await exampleLog.publish(null, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, signature: null, message: { clock: 1, parents: [], payload: "foo" } }])
	t.deepEqual(await recipients, [])
})

test("apply an unsigned message offline without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages.push({ id, signature, message })
			return { result: undefined }
		},
		signatures: false,
		sequencing: false,
	})

	const message = await exampleLog.create("foo")
	const { id, result, recipients } = await exampleLog.publish(null, message)
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, signature: null, message: { clock: 0, parents: [], payload: "foo" } }])
	t.deepEqual(await recipients, [])
})

test("apply two concurrent messages offline", async (t) => {
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => ({ result: undefined }),
		signatures: false,
	})

	const messageA = await exampleLog.create(nanoid())
	t.deepEqual(messageA.clock, 1)
	t.deepEqual(messageA.parents, [])

	const messageB = await exampleLog.create(nanoid())
	t.deepEqual(messageB.clock, 1)
	t.deepEqual(messageB.parents, [])

	const [{ id: idA, result: resultA }, { id: idB, result: resultB }] = await Promise.all([
		exampleLog.publish(null, messageA),
		exampleLog.publish(null, messageB),
	])

	t.is(resultA, undefined)
	t.is(resultB, undefined)
})

test("apply two serial messages offline", async (t) => {
	const exampleLog = await GossipLog.init(null, {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => ({ result: undefined }),
		signatures: false,
	})

	const messageA = await exampleLog.create(nanoid())
	t.deepEqual(messageA.clock, 1)
	t.deepEqual(messageA.parents, [])

	const { id: idA, result: resultA } = await exampleLog.publish(null, messageA)
	t.is(resultA, undefined)

	const messageB = await exampleLog.create(nanoid())
	t.deepEqual(messageB.clock, 2)
	t.deepEqual(messageB.parents, [base32.baseDecode(idA)])

	const { id: idB, result: resultB } = await exampleLog.publish(null, messageB)
	t.is(resultB, undefined)
})

test("send a message from one peer to another via gossipsub", async (t) => {
	const init: GossipLogInit = {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => ({ result: undefined }),
		signatures: false,
		merkleSync: false,
	}

	const network = await createNetwork(t, {
		a: { port: 9992, peers: ["b"], init },
		b: { port: 9993, peers: ["a"], init },
	})

	await waitForInitialConnections(network)

	const message = await network.a.create(nanoid())
	t.is(message.clock, 1)
	t.deepEqual(message.parents, [])

	const [{ id, result }] = await Promise.all([
		network.a.publish(null, message),
		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === message.payload),
	])

	t.log(`delivered ${id} to all peers`)
	t.is(result, undefined)
})

test("deliver two concurrent messages to two peers via gossipsub", async (t) => {
	t.timeout(20 * second)

	const init: GossipLogInit = {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => ({ result: undefined }),
		signatures: false,
		merkleSync: false,
	}

	const network = await createNetwork(t, {
		a: { port: 9994, peers: ["b"], init },
		b: { port: 9995, peers: ["a"], init },
	})

	await waitForInitialConnections(network)

	const messageA = await network.a.create(nanoid())
	t.is(messageA.clock, 1)
	t.deepEqual(messageA.parents, [])

	const messageB = await network.b.create(nanoid())
	t.is(messageB.clock, 1)
	t.deepEqual(messageB.parents, [])

	const [{ result: resultA }, { result: resultB }] = await Promise.all([
		network.a.publish(null, messageA),
		network.b.publish(null, messageB),
		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageA.payload),
		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageB.payload),
	])

	t.is(resultA, undefined)
	t.is(resultB, undefined)
})

test("exchange serial messages between two peers via gossipsub", async (t) => {
	t.timeout(20 * second)

	const init: GossipLogInit = {
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => ({ result: undefined }),
		signatures: false,
		merkleSync: false,
	}

	const network = await createNetwork(t, {
		a: { port: 9996, peers: ["b"], init },
		b: { port: 9997, peers: ["a"], init },
	})

	await waitForInitialConnections(network)

	const messageA = await network.a.create(nanoid())
	t.is(messageA.clock, 1)
	t.deepEqual(messageA.parents, [])

	const [{ id: idA, result: resultA }] = await Promise.all([
		network.a.publish(null, messageA),
		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageA.payload),
	])

	t.is(resultA, undefined)

	const messageB = await network.b.create(nanoid())
	t.is(messageB.clock, 2)
	t.deepEqual(messageB.parents, [base32.baseDecode(idA)])

	const [{ id: idB, result: resultB }] = await Promise.all([
		network.b.publish(null, messageB),
		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageB.payload),
	])

	t.is(resultB, undefined)
})
