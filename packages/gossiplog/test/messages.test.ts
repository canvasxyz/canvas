import test from "ava"

import { nanoid } from "nanoid"
import { base32 } from "multiformats/bases/base32"
import { ed25519 } from "@noble/curves/ed25519"

import { Signature, createSignature } from "@canvas-js/signed-cid"
import { IPLDValue, Message } from "@canvas-js/interfaces"

import openMessageLog from "@canvas-js/gossiplog/store"

import { createNetwork, waitForInitialConnections, waitForMessageDelivery } from "./libp2p.js"

const second = 1000

const validateIPLDValue = (payload: unknown): payload is IPLDValue => true

class Ed25519Signer<T = unknown> {
	private readonly privateKey = ed25519.utils.randomPrivateKey()
	public readonly publicKey = ed25519.getPublicKey(this.privateKey)

	sign(message: Message<T>) {
		return createSignature("ed25519", this.privateKey, message)
	}
}

test("apply a signed message", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateIPLDValue,
	})

	const signer = new Ed25519Signer()
	const { id, result } = await log.append("foo", { signer })

	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: signer.publicKey, message: { clock: 1, parents: [], payload: "foo" } }])
})

test("apply a signed message without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateIPLDValue,
		sequencing: false,
	})

	const signer = new Ed25519Signer()
	const { id, result } = await log.append("foo", { signer })
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: signer.publicKey, message: { clock: 0, parents: [], payload: "foo" } }])
})

test("apply an unsigned message", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateIPLDValue,
		signatures: false,
	})

	const { id, result } = await log.append("foo")
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: null, message: { clock: 1, parents: [], payload: "foo" } }])
})

test("apply an unsigned message without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateIPLDValue,
		signatures: false,
		sequencing: false,
	})

	const { id, result } = await log.append("foo")
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: null, message: { clock: 0, parents: [], payload: "foo" } }])
})

test("apply two messages in serial", async (t) => {
	const messages: Record<string, [Signature | null, Message]> = {}
	const log = await openMessageLog<string, void>({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages[message.payload] = [signature, message]
		},
		validate: (payload): payload is string => typeof payload === "string",
		signatures: false,
	})

	const [a, b] = [nanoid(), nanoid()]
	const { id: idA } = await log.append(a)
	const { id: idB } = await log.append(b)
	t.deepEqual(messages, {
		[a]: [null, { clock: 1, parents: [], payload: a }],
		[b]: [null, { clock: 2, parents: [base32.baseDecode(idA)], payload: b }],
	})
})

test("apply two concurrent messages", async (t) => {
	const messages: Record<string, [Signature | null, Message]> = {}
	const log = await openMessageLog<string, void>({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages[message.payload] = [signature, message]
		},
		validate: (payload): payload is string => typeof payload === "string",
		signatures: false,
	})

	const [a, b] = [nanoid(), nanoid()]
	await log.insert(null, { clock: 1, parents: [], payload: a })
	await log.insert(null, { clock: 1, parents: [], payload: b })

	t.deepEqual(messages, {
		[a]: [null, { clock: 1, parents: [], payload: a }],
		[b]: [null, { clock: 1, parents: [], payload: b }],
	})
})

// test("send a message from one peer to another via gossipsub", async (t) => {
// 	const init: GossipLogInit = {
// 		topic: "com.example.test",
// 		apply: () => {},
// 		location: null,
// 		signatures: false,
// 		merkleSync: false,
// 	}

// 	const network = await createNetwork(t, {
// 		a: { port: 9992, peers: ["b"], init },
// 		b: { port: 9993, peers: ["a"], init },
// 	})

// 	await waitForInitialConnections(network)

// 	const message = await network.a.create(nanoid())
// 	t.is(message.clock, 1)
// 	t.deepEqual(message.parents, [])

// 	const [{ id, result }] = await Promise.all([
// 		network.a.publish(null, message),
// 		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === message.payload),
// 	])

// 	t.log(`delivered ${id} to all peers`)
// 	t.is(result, undefined)
// })

// test("deliver two concurrent messages to two peers via gossipsub", async (t) => {
// 	t.timeout(20 * second)

// 	const init: GossipLogInit = {
// 		location: null,
// 		topic: "com.example.test",
// 		apply: () => {},
// 		signatures: false,
// 		merkleSync: false,
// 	}

// 	const network = await createNetwork(t, {
// 		a: { port: 9994, peers: ["b"], init },
// 		b: { port: 9995, peers: ["a"], init },
// 	})

// 	await waitForInitialConnections(network)

// 	const messageA = await network.a.create(nanoid())
// 	t.is(messageA.clock, 1)
// 	t.deepEqual(messageA.parents, [])

// 	const messageB = await network.b.create(nanoid())
// 	t.is(messageB.clock, 1)
// 	t.deepEqual(messageB.parents, [])

// 	const [{ result: resultA }, { result: resultB }] = await Promise.all([
// 		network.a.publish(null, messageA),
// 		network.b.publish(null, messageB),
// 		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageA.payload),
// 		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageB.payload),
// 	])

// 	t.is(resultA, undefined)
// 	t.is(resultB, undefined)
// })

// test("exchange serial messages between two peers via gossipsub", async (t) => {
// 	t.timeout(20 * second)

// 	const init: GossipLogInit = {
// 		location: null,
// 		topic: "com.example.test",
// 		apply: () => {},
// 		signatures: false,
// 		merkleSync: false,
// 	}

// 	const network = await createNetwork(t, {
// 		a: { port: 9996, peers: ["b"], init },
// 		b: { port: 9997, peers: ["a"], init },
// 	})

// 	await waitForInitialConnections(network)

// 	const messageA = await network.a.create(nanoid())
// 	t.is(messageA.clock, 1)
// 	t.deepEqual(messageA.parents, [])

// 	const [{ id: idA, result: resultA }] = await Promise.all([
// 		network.a.publish(null, messageA),
// 		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageA.payload),
// 	])

// 	t.is(resultA, undefined)

// 	const messageB = await network.b.create(nanoid())
// 	t.is(messageB.clock, 2)
// 	t.deepEqual(messageB.parents, [base32.baseDecode(idA)])

// 	const [{ id: idB, result: resultB }] = await Promise.all([
// 		network.b.publish(null, messageB),
// 		waitForMessageDelivery(t, network, (id, signature, { payload }) => payload === messageB.payload),
// 	])

// 	t.is(resultB, undefined)
// })
