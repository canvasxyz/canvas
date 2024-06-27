import assert from "node:assert"
import test from "ava"
import * as json from "@ipld/dag-json"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

function resolveCounterValue(v: any) {
	if (typeof v != "string") {
		return
	}
	let total = 0
	for (const value of Object.values(JSON.parse(v)) as number[]) {
		total += value
	}
	return total
}

async function createCanvasCounterApp() {
	const wallet = ethers.Wallet.createRandom()

	type CounterRecord = {
		id: string
		value: string
	}
	const topic = "xyz.canvas.crdt-counter"
	return await Canvas.initialize({
		topic,
		signers: [new SIWESigner({ signer: wallet })],
		contract: {
			topic,
			models: {
				counter: {
					id: "primary",
					value: "json",
					$merge: (counter1: CounterRecord, counter2: CounterRecord): CounterRecord => {
						const value1 = JSON.parse(counter1.value)
						const value2 = JSON.parse(counter2.value)

						const outputValue: Record<string, number> = {}
						for (const key of Object.keys({ ...value1, ...value2 })) {
							outputValue[key] = Math.max(value1[key] || 0, value2[key] || 0)
						}
						return { id: counter1.id, value: JSON.stringify(outputValue) }
					},
				},
			},
			actions: {
				async createCounter(db, {}, { id }) {
					await db.set("counter", { id, value: "{}" })
				},
				async incrementCounter(db, { id }: { id: string }, { did }) {
					const counter = await db.get("counter", id)
					assert(counter !== null)
					assert(typeof counter.value === "string")
					const value = JSON.parse(counter.value)
					if (!value[did]) {
						value[did] = 0
					}
					value[did] += 1
					await db.set("counter", { id, value: JSON.stringify(value) })
				},
				async nop(db, { id }: { id: string }, {}) {
					const counter = await db.get("counter", id)
					assert(counter !== null)
					await db.set("counter", { id, value: counter.value })
				},
			},
		},
		start: false,
	})
}

test("get a value set by another action that has been merged", async (t) => {
	const app1 = await createCanvasCounterApp()
	const app2 = await createCanvasCounterApp()

	t.teardown(() => {
		app1.stop()
		app2.stop()
	})

	async function getCounterValue(app: Awaited<ReturnType<typeof createCanvasCounterApp>>, id: string) {
		const result = await app.db.get("counter", id)
		if (result == null) {
			return null
		}
		return resolveCounterValue(result.value)
	}

	// app1 creates a counter
	const { id: counterId } = await app1.actions.createCounter({})

	// app1 has an empty counter
	t.is(await getCounterValue(app1, counterId), 0)
	// app2 does not have a counter yet
	t.is(await getCounterValue(app2, counterId), null)

	// sync app2 with app1
	await app1.messageLog.serve((source) => app2.messageLog.sync(source))

	// app2 should have the empty counter now
	t.is(await getCounterValue(app2, counterId), 0)

	// increment the counter in app1
	await app1.actions.incrementCounter({ id: counterId })

	// should update app1's counter
	t.is(await getCounterValue(app1, counterId), 1)
	// app2 is not synced yet so its the same
	t.is(await getCounterValue(app2, counterId), 0)

	// increment the counter in app2
	await app2.actions.incrementCounter({ id: counterId })

	// app1 is not synced yet
	t.is(await getCounterValue(app1, counterId), 1)
	// should update app2's counter
	t.is(await getCounterValue(app2, counterId), 1)

	// sync app2 with app1 again
	await app1.messageLog.serve((source) => app2.messageLog.sync(source))

	// app1 is still not synced yet
	t.is(await getCounterValue(app1, counterId), 1)
	// app2 now has app1 and app2's counter increment
	t.is(await getCounterValue(app2, counterId), 2)

	// sync app1 with app2
	await app2.messageLog.serve((source) => app1.messageLog.sync(source))

	// now app1 has app2's counter increment
	t.is(await getCounterValue(app1, counterId), 2)
	// app2 now has app1 and app2's counter increment
	t.is(await getCounterValue(app2, counterId), 2)
})
