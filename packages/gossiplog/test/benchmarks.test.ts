import test, { ExecutionContext } from "ava"

import { Message } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { AbstractGossipLog } from "@canvas-js/gossiplog"
import { GossipLog as MemoryGossipLog } from "@canvas-js/gossiplog/memory"
import { GossipLog } from "@canvas-js/gossiplog/node"

import { getDirectory } from "./utils.js"

const topic = "com.example.test"
const apply = (id: string, signature: Signature | null, message: Message<string>) => {}
const validate = (payload: unknown): payload is string => true

test("append messages (memory, linear, 100)", async (t) => {
	const log = await MemoryGossipLog.open({ topic, apply, validate, signatures: false })
	t.teardown(() => log.close())
	await append(t, log, 100)
})

// test("append messages (node, linear, 100)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, signatures: false })
// 	t.teardown(() => log.close())
// 	await append(t, log, 100)
// })

// like what if it's
// ```
// import { Runtime } from "@canvas-js/runtime"

// ```

// ```
// import { Runtime } from "@canvas-js/runtime/vm"

// ```

// test("append messages (node, linear, 100, indexed)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, signatures: false, indexAncestors: true })
// 	t.teardown(() => log.close())
// 	await append(t, log, 100)
// })

// test("append messages (node, linear, 10000)", async (t) => {
// 	const log = await GossipLog.open(getDirectory(t), { topic, apply, validate, signatures: false })
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

async function append(t: ExecutionContext, log: AbstractGossipLog<string, void>, n: number) {
	const start = performance.now()

	for (let i = 0; i < n; i++) {
		await log.append(i.toString())
	}

	const time = performance.now() - start
	t.log(`appended ${n} messages in ${time.toPrecision(4)}ms`)
	t.pass()
}
