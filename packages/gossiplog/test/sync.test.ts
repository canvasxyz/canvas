import assert from "node:assert"
import test from "ava"
import { randomBytes, randomUUID } from "node:crypto"
import { nanoid } from "nanoid"
import * as lp from "it-length-prefixed"
import { pushable } from "it-pushable"
import { pipe } from "it-pipe"

import type { GossipLogConsumer, GossipLogEvents } from "@canvas-js/gossiplog"
import {
	Server,
	Client,
	decodeResponses,
	encodeRequests,
	decodeRequests,
	encodeResponses,
} from "@canvas-js/gossiplog/sync"
import { Request, Response } from "@canvas-js/gossiplog/protocols/sync"
import { getLibp2p } from "@canvas-js/gossiplog/libp2p/node"
import { createWebSocketAPI, sync } from "@canvas-js/gossiplog/api"

import { testPlatforms, expectLogEntries, getDirectory } from "./utils.js"
import { Uint8ArrayList } from "uint8arraylist"
import { CodeError } from "@libp2p/interface"
import { SECONDS } from "@canvas-js/utils"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { multiaddr } from "@multiformats/multiaddr"
import { createNetwork } from "./libp2p.js"

const apply: GossipLogConsumer<string> = ({}) => {}

// testPlatforms(
// 	"sync",
// 	async (t, openGossipLog) => {
// 		const topic = randomUUID()
// 		const a = await openGossipLog(t, { topic, apply })
// 		const b = await openGossipLog(t, { topic, apply })

// 		await a.append(nanoid())
// 		await a.append(nanoid())
// 		await a.append(nanoid())

// 		await b.serve((txn) => a.sync(txn)).then(({ messageCount }) => t.is(messageCount, 0))
// 		await a.serve((txn) => b.sync(txn)).then(({ messageCount }) => t.is(messageCount, 3))
// 	},
// 	{ sqlite: true },
// )

// testPlatforms(
// 	"pipe Client and Servers directly",
// 	async (t, openGossipLog) => {
// 		const topic = randomUUID()
// 		const a = await openGossipLog(t, { topic, apply })
// 		const b = await openGossipLog(t, { topic, apply })

// 		await a.append(nanoid())
// 		await a.append(nanoid())
// 		await a.append(nanoid())

// 		await a.serve(async (txn) => {
// 			const server = new Server(topic, txn)

// 			const client = new Client(nanoid(), server.responses)

// 			await Promise.all([
// 				server.handle(client.requests),
// 				b.sync(client).then(({ messageCount }) => {
// 					t.is(messageCount, 3)
// 					client.end()
// 				}),
// 			])
// 		})
// 	},
// 	{ sqlite: true },
// )

// testPlatforms(
// 	"abort after timeout",
// 	async (t, openGossipLog) => {
// 		t.timeout(20 * SECONDS)
// 		const topic = randomUUID()
// 		const a = await openGossipLog(t, { topic, apply })
// 		const b = await openGossipLog(t, { topic, apply })

// 		await a.append(nanoid())
// 		await a.append(nanoid())
// 		await a.append(nanoid())

// 		await a.serve(async (txn) => {
// 			const server = new Server(topic, txn)

// 			async function* delay<T>(iter: AsyncIterable<T>, ms: number): AsyncGenerator<T> {
// 				for await (const item of iter) {
// 					await setTimeout(ms)
// 					// console.log("yielding", item)
// 					yield item
// 				}
// 			}

// 			const client = new Client(nanoid(), server.responses)

// 			await Promise.all([
// 				server.handle(delay(client.requests, 5000)),
// 				t.throwsAsync(() => b.sync(client).finally(() => client.end()), { code: Client.codes.ABORT }),
// 			])
// 		})
// 	},
// 	{ sqlite: true },
// )

// testPlatforms(
// 	"abort after timeout (logs)",
// 	async (t, openGossipLog) => {
// 		t.timeout(120 * SECONDS)
// 		const topic = randomUUID()

// 		const a = await openGossipLog(t, { topic, apply })
// 		const b = await openGossipLog(t, { topic, apply })

// 		const messageCount = 10000
// 		for (let i = 0; i < messageCount; i++) {
// 			await a.append(nanoid(8))
// 		}

// 		const peerIdA = await createEd25519PeerId()
// 		const peerIdB = await createEd25519PeerId()

// 		{
// 			const libp2p = await getLibp2p({
// 				start: false,
// 				peerId: peerIdA,
// 				listen: ["/ip4/127.0.0.1/tcp/9990/ws"],
// 				announce: [],
// 			})

// 			await libp2p.start()
// 			await a.listen(libp2p)
// 			t.teardown(() => libp2p.stop())
// 		}

// 		{
// 			const libp2p = await getLibp2p({
// 				start: false,
// 				peerId: peerIdB,
// 				listen: ["/ip4/127.0.0.1/tcp/9991/ws"],
// 				announce: [],
// 				minConnections: 1,
// 				bootstrapList: [`/ip4/127.0.0.1/tcp/9990/ws/p2p/${peerIdA}`],
// 			})

// 			await libp2p.start()
// 			await b.listen(libp2p)
// 			t.teardown(() => libp2p.stop())
// 		}

// 		await new Promise<GossipLogEvents["sync"]>((resolve) =>
// 			b.addEventListener("sync", (event) => event, { once: true }),
// 		).then((event) => t.is(event.detail.messageCount, messageCount))
// 	},
// 	{ sqlite: true },
// )

// testPlatforms(
// 	"ws sync",
// 	async (t, openGossipLog) => {
// 		const topic = randomUUID()
// 		const a = await openGossipLog(t, { topic, apply })
// 		const b = await openGossipLog(t, { topic, apply })

// 		const messageCount = 10
// 		for (let i = 0; i < messageCount; i++) {
// 			await a.append(nanoid(8))
// 		}

// 		const server = createWebSocketAPI(a)
// 		await server.listen(5555)
// 		t.teardown(() => server.close())

// 		await sync(b, "ws://127.0.0.1:5555")
// 		t.pass()
// 	},
// 	{ sqlite: true },
// )
//
testPlatforms(
	"ws sync",
	async (t, openGossipLog) => {
		t.timeout(120 * SECONDS)

		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })

		const messageCount = 10000
		for (let i = 0; i < messageCount; i++) {
			await a.append(nanoid(8))
		}

		const server = createWebSocketAPI(a)
		await server.listen(5555)
		t.teardown(() => server.close())

		await sync(b, "ws://127.0.0.1:5555")
		t.pass()
	},
	{ sqlite: true },
)
