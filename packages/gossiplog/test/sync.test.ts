import assert from "node:assert"
import { randomUUID } from "node:crypto"
import { nanoid } from "nanoid"
import * as lp from "it-length-prefixed"
import { pushable } from "it-pushable"
import { pipe } from "it-pipe"

import type { GossipLogConsumer } from "@canvas-js/gossiplog"
import {
	Server,
	Client,
	decodeResponses,
	encodeRequests,
	decodeRequests,
	encodeResponses,
} from "@canvas-js/gossiplog/sync"
import { Request, Response } from "@canvas-js/gossiplog/protocols/sync"

import { testPlatforms, expectLogEntries } from "./utils.js"
import { Uint8ArrayList } from "uint8arraylist"
import { setTimeout } from "node:timers/promises"
import { CodeError } from "@libp2p/interface"
import { SECONDS } from "@canvas-js/utils"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms(
	"sync",
	async (t, openGossipLog) => {
		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })

		await a.append(nanoid())
		await a.append(nanoid())
		await a.append(nanoid())

		await b.serve((txn) => a.sync(txn)).then(({ messageCount }) => t.is(messageCount, 0))
		await a.serve((txn) => b.sync(txn)).then(({ messageCount }) => t.is(messageCount, 3))
	},
	{ sqlite: true },
)

testPlatforms(
	"pipe Client and Servers directly",
	async (t, openGossipLog) => {
		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })

		await a.append(nanoid())
		await a.append(nanoid())
		await a.append(nanoid())

		await a.serve(async (txn) => {
			const server = new Server(topic, txn)

			const client = new Client(nanoid(), server.responses)

			await Promise.all([
				server.handle(client.requests),
				b.sync(client).then(({ messageCount }) => {
					t.is(messageCount, 3)
					client.end()
				}),
			])
		})
	},
	{ sqlite: true },
)

testPlatforms(
	"abort after timeout",
	async (t, openGossipLog) => {
		t.timeout(20 * SECONDS)
		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })

		await a.append(nanoid())
		await a.append(nanoid())
		await a.append(nanoid())

		await a.serve(async (txn) => {
			const server = new Server(topic, txn)

			async function* delay<T>(iter: AsyncIterable<T>, ms: number): AsyncGenerator<T> {
				for await (const item of iter) {
					await setTimeout(ms)
					// console.log("yielding", item)
					yield item
				}
			}

			const client = new Client(nanoid(), server.responses)

			await Promise.all([
				server.handle(delay(client.requests, 5000)),
				t.throwsAsync(() => b.sync(client).finally(() => client.end()), { code: Client.codes.ABORT }),
			])
		})
	},
	{ sqlite: true },
)
