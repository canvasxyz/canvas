import test from "ava"

import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"

import { createNetwork, waitForInitialConnections, waitForMessageDelivery } from "./libp2p.js"

const validateString = (payload: unknown): payload is string => true

test("send a message from one peer to another via gossipsub", async (t) => {
	const network = await createNetwork(t, {
		a: { port: 9992, peers: ["b"], init: { sync: false } },
		b: { port: 9993, peers: ["a"], init: { sync: false } },
	})

	const messagesA: Record<string, Message<string>> = {}
	const messagesB: Record<string, Message<string>> = {}

	const topic = "com.example.test"

	await Promise.all([
		network.a.services.gossiplog.subscribe(topic, {
			apply: (id, signature, message) => void (messagesA[message.payload] = message),
			validate: validateString,
			signatures: false,
		}),
		network.b.services.gossiplog.subscribe(topic, {
			apply: (id, signature, message) => void (messagesB[message.payload] = message),
			validate: validateString,
			signatures: false,
		}),
	])

	await waitForInitialConnections(network)

	const payload = nanoid()

	const [{ message }, { id, result }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payload),
		network.a.services.gossiplog.publish(topic, payload),
	])

	t.log(`delivered ${id} to all peers`)
	t.is(result, undefined)
	t.is(message.clock, 1)
	t.deepEqual(message.parents, [])
})

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
