import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

import { getDirectory } from "./utils.js"

const topic = "com.example.test"
const apply = ({}: SignedMessage<string>) => {}

test("append messages (in-memory, linear, 100)", async (t) => {
	const log = new GossipLog({ topic, apply })
	t.teardown(() => log.close())
	await append(t, log, 100)
})

test("append messages (on-disk, linear, 100)", async (t) => {
	const log = new GossipLog({ directory: getDirectory(t), topic, apply })
	t.teardown(() => log.close())
	await append(t, log, 100)
})

// test("append messages (node, linear, 100, indexed)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, indexAncestors: true })
// 	t.teardown(() => log.close())
// 	await append(t, log, 100)
// })

// test("append messages (node, linear, 10000)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate })
// 	t.teardown(() => log.close())
// 	await append(t, log, 10_000)
// })

// test("append messages (node, linear, 10000, indexed)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, signatures: false, indexAncestors: true })
// 	t.teardown(() => log.close())
// 	await append(t, log, 10_000)
// })

// test("append messages (node, linear, 100_000)", async (t) => {
// 	t.timeout(20 * 1000)
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, signatures: false })
// 	t.teardown(() => log.close())
// 	await append(t, log, 100_000)
// })

async function append(t: ExecutionContext, log: AbstractGossipLog<string>, n: number) {
	const start = performance.now()

	for (let i = 0; i < n; i++) {
		await log.append(nanoid())
	}

	const time = performance.now() - start
	t.log(`appended ${n} messages in ${time.toPrecision(4)}ms`)
	t.pass()
}
