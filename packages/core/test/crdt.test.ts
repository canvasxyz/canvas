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

// test("get a value set by another action that has been merged", async (t) => {
// 	const app1 = await createCanvasCounterApp()
// 	const app2 = await createCanvasCounterApp()

// 	t.teardown(() => {
// 		app1.stop()
// 		app2.stop()
// 	})

// 	console.log(`app1 did:${await app1.signers.getFirst().getDid()}`)
// 	console.log(`app2 did:${await app2.signers.getFirst().getDid()}`)

// 	const { id: counterId } = await app1.actions.createCounter({})
// 	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 0)
// 	t.is(await app2.db.get("counter", counterId), null)

// 	// sync app2 with app1
// 	await app1.messageLog.serve((source) => app2.messageLog.sync(source))

// 	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 0)

// 	// increment the counter in app1
// 	await app1.actions.incrementCounter({ id: counterId })

// 	// should update app1's counter
// 	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 1)

// 	// sync app2 with app1
// 	await app1.messageLog.serve((source) => app2.messageLog.sync(source))

// 	// should update app2's counter now
// 	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 1)
// })

test("get a value set by another action that has been merged", async (t) => {
	const app1 = await createCanvasCounterApp()
	const app2 = await createCanvasCounterApp()

	t.teardown(() => {
		app1.stop()
		app2.stop()
	})

	console.log(`app1 did:${await app1.signers.getFirst().getDid()}`)
	console.log(`app2 did:${await app2.signers.getFirst().getDid()}`)

	const { id: counterId } = await app1.actions.createCounter({})
	console.log(counterId)
	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 0)
	t.is(await app2.db.get("counter", counterId), null)

	// sync app2 with app1
	await app1.messageLog.serve((source) => app2.messageLog.sync(source))

	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 0)

	// increment the counter in app1
	// console.log(await app1.db.query("$effects"))
	await app1.actions.incrementCounter({ id: counterId })

	// should update app1's counter
	console.log("app1 counter after updating")
	console.log(await app1.db.get("counter", counterId))
	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 1)
	// app2 is not synced yet so its the same
	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 0)

	// increment the counter in app2
	await app2.actions.incrementCounter({ id: counterId })
	// app1 is not synced yet
	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 1)
	// should update app2's counter
	console.log("app2 counter after updating")
	console.log(await app2.db.get("counter", counterId))
	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 1)

	// sync app2 with app1 again

	console.log("syncing app1 -> app2")
	await app1.messageLog.serve((source) => app2.messageLog.sync(source))
	// app1 is still not synced yet
	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 1)
	// app2 now has app1 and app2's counter increment
	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 2)

	// sync app1 with app2
	console.log("syncing app2 -> app1")
	console.log(JSON.stringify(JSON.parse(json.stringify(await app1.messageLog.export())), null, 2))
	console.log(JSON.stringify(JSON.parse(json.stringify(await app2.messageLog.export())), null, 2))
	await app2.messageLog.serve((source) => app1.messageLog.sync(source))
	// now app1 has app2's counter increment
	console.log("c")
	t.is(resolveCounterValue((await app1.db.get("counter", counterId))!.value), 2)
	console.log("d")
	// app2 now has app1 and app2's counter increment
	t.is(resolveCounterValue((await app2.db.get("counter", counterId))!.value), 2)
	console.log("e")
})
