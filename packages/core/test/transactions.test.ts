import assert from "assert"
import Prando from "prando"
import * as cbor from "@ipld/dag-cbor"

import test, { ExecutionContext } from "ava"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Actions, Canvas, ModelSchema } from "@canvas-js/core"

const rng = new Prando.default(0)

const random = (n: number) => rng.nextInt(0, n - 1)

const models = {
	counter: { id: "primary", value: "integer" },
} satisfies ModelSchema

const actions = {
	async increment(db) {
		const record = await db.get("counter", "counter")
		await db.transaction(async () => {
			if (record === null) {
				await db.set("counter", { id: "counter", value: 1 })
			} else {
				await db.set("counter", { id: "counter", value: record.value + 1 })
			}
		})
	},
} satisfies Actions<typeof models>

const init = async (t: ExecutionContext<unknown>) => {
	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		contract: { models, actions },
		topic: "com.example.app",
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return app
}

test("write transactional values", async (t) => {
	const app1 = await init(t)
	const app2 = await init(t)

	let total = 0

	const apps = [app1, app2]
	for (let i = 0; i < 100; i++) {
		const app = apps[random(2)]
		const count = 1 + random(10)
		for (let j = 0; j < count; j++) {
			total += 1
			await app.actions.increment()
		}

		if (random(2) === 0) {
			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
		}

		if (random(2) === 0) {
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
		}
	}

	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	const counter1 = await app1.db.get<{ id: string; value: number }>("counter", "counter")
	const counter2 = await app2.db.get<{ id: string; value: number }>("counter", "counter")

	t.log("total", total)
	t.log("counter1", counter1?.value)
	t.log("counter2", counter2?.value)

	t.is(counter1?.value, counter2?.value)
	t.true(counter1!.value < total)
	t.true(counter2!.value < total)

	type WriteRecord = { record_id: string; message_id: string; csx: number | null; value: Uint8Array | null }

	for await (const { csx, value } of app1.db.iterate<WriteRecord>("$writes", {
		orderBy: { "record_id/csx/message_id": "asc" },
	})) {
		assert(t.truthy<Uint8Array | null>(value))
		const record = cbor.decode<{ id: string; value: number }>(value)
		t.is(csx, record.value)
	}

	for await (const { csx, value } of app2.db.iterate<WriteRecord>("$writes", {
		orderBy: { "record_id/csx/message_id": "asc" },
	})) {
		assert(t.truthy<Uint8Array | null>(value))
		const record = cbor.decode<{ id: string; value: number }>(value)
		t.is(csx, record.value)
	}

	t.pass()
})
