import test from "ava"

import { nanoid } from "nanoid"
import { GossipLog } from "@canvas-js/gossiplog/memory"

import { createNetwork, waitForInitialConnections, waitForMessageDelivery } from "./libp2p.js"

test("send a message from one peer to another via gossipsub", async (t) => {
	const topic = "com.example.test"
	const gossipLogs = {
		a: await GossipLog.open({ topic, apply: () => {} }),
		b: await GossipLog.open({ topic, apply: () => {} }),
	}

	const network = await createNetwork(t, {
		a: { port: 9990, peers: ["b"], init: { sync: false } },
		b: { port: 9991, peers: ["a"], init: { sync: false } },
	})

	await waitForInitialConnections(network)

	await Promise.all([
		network.a.services.gossiplog.subscribe(gossipLogs.a),
		network.b.services.gossiplog.subscribe(gossipLogs.b),
	])

	const payload = nanoid()

	const [{ message }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payload),
		network.a.services.gossiplog.append(topic, payload),
	])

	t.deepEqual(message.parents, [])
})

// test("deliver two concurrent messages to two peers via gossipsub", async (t) => {
// 	const topic = "com.example.test"
// 	const messageLogs = {
// 		a: await MessageLog.open({ topic, apply: () => {}, validate: validateString, signatures: false }),
// 		b: await MessageLog.open({ topic, apply: () => {}, validate: validateString, signatures: false }),
// 	}

// 	const network = await createNetwork(t, {
// 		a: { port: 9992, peers: ["b"], init: { sync: false } },
// 		b: { port: 9993, peers: ["a"], init: { sync: false } },
// 	})

// 	await network.a.services.gossiplog.subscribe(messageLogs.a)
// 	await network.b.services.gossiplog.subscribe(messageLogs.b)

// 	await waitForInitialConnections(network)

// 	const [payloadA, payloadB] = [nanoid(), nanoid()]
// 	const [{ message: messageA }, { message: messageB }] = await Promise.all([
// 		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadA),
// 		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadB),
// 		network.a.services.gossiplog.append(topic, payloadA),
// 		network.b.services.gossiplog.append(topic, payloadB),
// 	])

// 	t.is(messageA.clock, 1)
// 	t.is(messageB.clock, 1)
// 	t.deepEqual(messageA.parents, [])
// 	t.deepEqual(messageB.parents, [])
// })

// test("exchange serial messages between two peers via gossipsub", async (t) => {
// 	const topic = "com.example.test"
// 	const messageLogs = {
// 		a: await MessageLog.open({ topic, apply: () => {}, validate: validateString, signatures: false }),
// 		b: await MessageLog.open({ topic, apply: () => {}, validate: validateString, signatures: false }),
// 	}

// 	const network = await createNetwork(t, {
// 		a: { port: 9994, peers: ["b"], init: { sync: false } },
// 		b: { port: 9995, peers: ["a"], init: { sync: false } },
// 	})

// 	await network.a.services.gossiplog.subscribe(messageLogs.a)
// 	await network.b.services.gossiplog.subscribe(messageLogs.b)

// 	// const topic = "com.example.test"

// 	// await Promise.all([
// 	// 	network.a.services.gossiplog.subscribe(topic, { apply: () => {}, validate: validateString, signatures: false }),
// 	// 	network.b.services.gossiplog.subscribe(topic, { apply: () => {}, validate: validateString, signatures: false }),
// 	// ])

// 	await waitForInitialConnections(network)

// 	const [payloadA, payloadB] = [nanoid(), nanoid()]

// 	const [{ id: idA, message: messageA }] = await Promise.all([
// 		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadA),
// 		network.a.services.gossiplog.append(topic, payloadA),
// 	])

// 	t.is(messageA.clock, 1)
// 	t.deepEqual(messageA.parents, [])

// 	const [{ id: idB, message: messageB }] = await Promise.all([
// 		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadB),
// 		network.b.services.gossiplog.append(topic, payloadB),
// 	])

// 	t.is(messageB.clock, 2)
// 	t.deepEqual(messageB.parents, [idA])
// })
