import { setTimeout } from "node:timers/promises"
import { randomUUID } from "node:crypto"

import { nanoid } from "nanoid"

import type { GossipLogConsumer } from "@canvas-js/gossiplog"

import { testPlatforms } from "./utils.js"

const apply: GossipLogConsumer<string> = ({}) => {}

testPlatforms(
	"ws publish",
	async (t, openGossipLog) => {
		const topic = randomUUID()
		const a = await openGossipLog(t, { topic, apply })
		const b = await openGossipLog(t, { topic, apply })
		const c = await openGossipLog(t, { topic, apply })

		await a.listen(5555)
		await b.connect("ws://127.0.0.1:5555")
		await c.connect("ws://127.0.0.1:5555")

		await setTimeout(1000)

		const { id, signature, message } = await b.append(nanoid())

		await setTimeout(1000)

		const result = await c.get(id)
		t.deepEqual(result?.signature, signature)
		t.deepEqual(result?.message, message)

		t.pass()
	},
	{ sqlite: true },
)
