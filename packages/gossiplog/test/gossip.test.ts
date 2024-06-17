import test from "ava"

import { randomUUID } from "crypto"
import { nanoid } from "nanoid"

import { GossipLogConsumer } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

import { createNetwork, waitForInitialConnections, waitForMessageDelivery } from "./libp2p.js"

test("send a message from one peer to another via gossipsub", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => new GossipLog({ topic, apply }), {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	})

	await waitForInitialConnections(network)

	const payload = nanoid()

	const [{ message }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payload),
		network.a.services.gossiplog.append(payload),
	])

	t.deepEqual(message.parents, [])
})

test("deliver two concurrent messages to two peers via gossipsub", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => new GossipLog({ topic, apply }), {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	})

	await waitForInitialConnections(network)

	const [payloadA, payloadB] = [nanoid(), nanoid()]
	const [{ message: messageA }, { message: messageB }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadA),
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadB),
		network.a.services.gossiplog.append(payloadA),
		network.b.services.gossiplog.append(payloadB),
	])

	t.is(messageA.clock, 1)
	t.is(messageB.clock, 1)
	t.deepEqual(messageA.parents, [])
	t.deepEqual(messageB.parents, [])
})

test("exchange serial messages between two peers via gossipsub", async (t) => {
	const topic = randomUUID()
	const apply: GossipLogConsumer<string> = (i) => {}

	const network = await createNetwork(t, () => new GossipLog({ topic, apply }), {
		a: { port: 9990, peers: ["b"] },
		b: { port: 9991, peers: ["a"] },
	})

	await waitForInitialConnections(network)

	const [payloadA, payloadB] = [nanoid(), nanoid()]

	const [{ id: idA, message: messageA }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadA),
		network.a.services.gossiplog.append(payloadA),
	])

	t.is(messageA.clock, 1)
	t.deepEqual(messageA.parents, [])

	const [{ id: idB, message: messageB }] = await Promise.all([
		waitForMessageDelivery(t, network, (id, signature, message) => message.payload === payloadB),
		network.b.services.gossiplog.append(payloadB),
	])

	t.is(messageB.clock, 2)
	t.deepEqual(messageB.parents, [idA])
})
