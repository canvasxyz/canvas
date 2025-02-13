import assert from "assert"
import Prando from "prando"
import * as cbor from "@ipld/dag-cbor"

import test, { ExecutionContext } from "ava"

import { Actions, Canvas, ModelSchema } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Wallet } from "ethers"
import { bytesToHex } from "@noble/hashes/utils"
import { PRNGSigner } from "./utils.js"
import { AbstractModelDB, ModelValue } from "@canvas-js/modeldb"

// test("increment a counter, reading outside the transaction", async (t) => {
// 	const rng = new Prando.default(0)

// 	const random = (n: number) => rng.nextInt(0, n - 1)

// 	const models = {
// 		counter: { id: "primary", value: "integer" },
// 	} satisfies ModelSchema

// 	const actions = {
// 		async increment(db) {
// 			const record = await db.get("counter", "counter")
// 			await db.transaction(async () => {
// 				if (record === null) {
// 					await db.set("counter", { id: "counter", value: 1 })
// 				} else {
// 					await db.set("counter", { id: "counter", value: record.value + 1 })
// 				}
// 			})
// 		},
// 	} satisfies Actions<typeof models>

// 	const init = async (t: ExecutionContext<unknown>) => {
// 		const app = await Canvas.initialize({
// 			contract: { models, actions },
// 			topic: "com.example.app",
// 		})

// 		t.teardown(() => app.stop())
// 		return app
// 	}

// 	const app1 = await init(t)
// 	const app2 = await init(t)

// 	let total = 0

// 	const apps = [app1, app2]
// 	for (let i = 0; i < 100; i++) {
// 		const app = apps[random(2)]
// 		const count = 1 + random(10)
// 		for (let j = 0; j < count; j++) {
// 			total += 1
// 			await app.actions.increment()
// 		}

// 		if (random(2) === 0) {
// 			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
// 		}

// 		if (random(2) === 0) {
// 			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
// 		}
// 	}

// 	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
// 	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

// 	const counter1 = await app1.db.get<{ id: string; value: number }>("counter", "counter")
// 	const counter2 = await app2.db.get<{ id: string; value: number }>("counter", "counter")

// 	t.log("total", total)
// 	t.log("counter1", counter1?.value)
// 	t.log("counter2", counter2?.value)

// 	t.is(counter1?.value, counter2?.value)
// 	t.true(counter1!.value < total)
// 	t.true(counter2!.value < total)

// 	type WriteRecord = { record_id: string; message_id: string; csx: number | null; value: Uint8Array | null }

// 	for await (const { csx, value } of app1.db.iterate<WriteRecord>("$writes", {
// 		orderBy: { "record_id/csx/message_id": "asc" },
// 	})) {
// 		assert(t.truthy<Uint8Array | null>(value))
// 		const record = cbor.decode<{ id: string; value: number }>(value)
// 		t.is(csx, record.value)
// 	}

// 	for await (const { csx, value } of app2.db.iterate<WriteRecord>("$writes", {
// 		orderBy: { "record_id/csx/message_id": "asc" },
// 	})) {
// 		assert(t.truthy<Uint8Array | null>(value))
// 		const record = cbor.decode<{ id: string; value: number }>(value)
// 		t.is(csx, record.value)
// 	}

// 	t.pass()
// })

test("increment a counter, reading inside the transaction", async (t) => {
	const rng = new Prando.default(0)
	const random = (n: number) => rng.nextInt(0, n - 1)

	const models = {
		counter: { id: "primary", value: "integer" },
	} satisfies ModelSchema

	const actions = {
		async increment(db) {
			let value = 1
			await db.transaction(async () => {
				const record = await db.get("counter", "counter")
				if (record !== null) {
					value = record.value + 1
				}
				await db.set("counter", { id: "counter", value })
			})

			return value
		},
	} satisfies Actions<typeof models>

	const init = async (t: ExecutionContext<unknown>, seed: number) => {
		const app = await Canvas.initialize({
			contract: { models, actions },
			topic: "com.example.app",
			signers: [new PRNGSigner(seed)],
		})

		t.teardown(() => app.stop())
		return app
	}

	const app1 = await init(t, 1)
	const app2 = await init(t, 2)

	let total = 0

	let time = 0
	let last: number

	const apps = [app1, app2]
	for (let i = 0; i < 2; i++) {
		const n = random(2)
		const app = apps[n]
		const count = 1 + random(4)
		for (let j = 0; j < count; j++) {
			total += 1
			const start = performance.now()
			const { id, result } = await app.actions.increment()
			console.log(`increment app${n + 1} ->`, id, result)
			last = performance.now() - start
			time += last
		}

		if (random(2) === 0) {
			console.log("syncing app2 -> app1")
			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
		}

		if (random(2) === 0) {
			console.log("syncing app1 -> app2")
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
		}
	}

	t.log(`total time: ${time.toPrecision(5)}ms`)
	t.log(`time per insert: ${(time / total).toPrecision(5)}ms`)
	t.log(`time for last insert: ${last!.toPrecision(5)}ms`)

	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	// const counter1 = await app1.db.get<{ id: string; value: number }>("counter", "counter")
	// const counter2 = await app2.db.get<{ id: string; value: number }>("counter", "counter")

	await compare(t, app1.db, app2.db, "$writes", ":")
	await compare(t, app1.db, app2.db, "$reads", ":")
	await compare(t, app1.db, app2.db, "$reverts", ":")
	await compare(t, app1.db, app2.db, "$versions", ":")

	// t.deepEqual(
	// 	await app1.db.query("$reverts", { orderBy: { "effect_id/cause_id": "asc" } }),
	// 	await app2.db.query("$reverts", { orderBy: { "effect_id/cause_id": "asc" } }),
	// )

	// t.deepEqual(
	// 	await app1.db.query("$versions", { orderBy: { id: "asc" } }),
	// 	await app2.db.query("$versions", { orderBy: { id: "asc" } }),
	// )

	const { result: counter1 } = await app1.actions.increment()
	const { result: counter2 } = await app2.actions.increment()

	t.log("total", total)
	t.log("counter1", counter1)
	t.log("counter2", counter2)

	t.is(counter1, counter2)
	t.true(counter1 <= total)
	t.true(counter2 <= total)

	// const reverts1 = await app1.db.query("$reverts", { orderBy: { "cause_id/effect_id": "asc" } })
	// console.log("reverts1 -----------------")
	// for (const { effect_id, cause_id } of reverts1) console.log(`${cause_id} -> ${effect_id}`)
	// const reverts2 = await app1.db.query("$reverts")
	// console.log("reverts2 -----------------")
	// for (const { effect_id, cause_id } of reverts2) console.log(`${cause_id} -> ${effect_id}`)

	// const reads1 = await app1.db.query("$reads", { orderBy: { "reader_id/record_id": "asc" } })
	// console.log("reads1 -----------------")
	// for (const read of reads1) console.log(`${read.record_id}: ${read.reader_id} <- ${read.writer_id}`)
	// const reads2 = await app1.db.query("$reads", { orderBy: { "reader_id/record_id": "asc" } })
	// console.log("reads2 -----------------")
	// for (const read of reads2) console.log(`${read.record_id}: ${read.reader_id} <- ${read.writer_id}`)

	// for await (const { csx, value } of app1.db.iterate<WriteRecord>("$writes", {
	// 	orderBy: { "record_id/csx/message_id": "asc" },
	// })) {
	// 	assert(t.truthy<Uint8Array | null>(value))
	// 	const record = cbor.decode<{ id: string; value: number }>(value)
	// 	t.is(csx, record.value)
	// }

	// for await (const { csx, value } of app2.db.iterate<WriteRecord>("$writes", {
	// 	orderBy: { "record_id/csx/message_id": "asc" },
	// })) {
	// 	assert(t.truthy<Uint8Array | null>(value))
	// 	const record = cbor.decode<{ id: string; value: number }>(value)
	// 	t.is(csx, record.value)
	// }

	t.pass()
})

async function compare(
	t: ExecutionContext<unknown>,
	a: AbstractModelDB,
	b: AbstractModelDB,
	model: string,
	keyDelimiter = "/",
) {
	t.deepEqual(await collect(a, model, keyDelimiter), await collect(b, model, keyDelimiter))
}

async function collect(db: AbstractModelDB, model: string, keyDelimiter = "/"): Promise<Record<string, ModelValue>> {
	const values: Record<string, ModelValue> = {}

	const { primaryKey } = db.models[model]
	for await (const value of db.iterate(model, { orderBy: { [primaryKey.join("/")]: "asc" } })) {
		const key = primaryKey.map((name) => value[name]).join(keyDelimiter)
		values[key] = value
	}

	return values
}
