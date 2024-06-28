import assert from "node:assert"
import test from "ava"
import * as json from "@ipld/dag-json"
import Prando from "prando"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

const rng = new Prando.default()

const random = (n: number) => rng.nextInt(0, n - 1)

function arrayRandom<T>(list: T[]): T {
	const index = random(list.length)
	return list[index]
}

function arrayRandomN<T>(list: T[], n: number): T[] {
	if (n > list.length) {
		throw new Error(`Cannot select ${n} distinct elements from a list of length ${list.length}`)
	}
	// make an array of indices
	const bucket = Array.from({ length: list.length }, (_, i) => i)

	const output: T[] = []
	for (let i = 0; i < n; i++) {
		const index = arrayRandom(bucket)
		bucket.splice(index, 1)
		output.push(list[index])
	}
	return output
}

function enumRandom<T extends object>(enumObj: T): T[keyof T] {
	const values = Object.values(enumObj)
	const index = random(values.length)
	return values[index]
}

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

type CounterRecord = {
	id: string
	value: string
}

function mergeCounterRecords(counter1: CounterRecord, counter2: CounterRecord): CounterRecord {
	const value1 = JSON.parse(counter1.value)
	const value2 = JSON.parse(counter2.value)

	const outputValue: Record<string, number> = {}
	for (const key of Object.keys({ ...value1, ...value2 })) {
		outputValue[key] = Math.max(value1[key] || 0, value2[key] || 0)
	}
	return { id: counter1.id, value: JSON.stringify(outputValue) }
}

async function createCanvasCounterApp() {
	const wallet = ethers.Wallet.createRandom()

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
					$merge: mergeCounterRecords,
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

async function getCounterValue(app: Awaited<ReturnType<typeof createCanvasCounterApp>>, id: string) {
	const result = await app.db.get("counter", id)
	if (result == null) {
		return null
	}
	return resolveCounterValue(result.value)
}

test("crdt counter manually created events", async (t) => {
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

test("crdt counter with randomized events", async (t) => {
	const apps = await Promise.all(Array.from({ length: 10 }, () => createCanvasCounterApp()))

	t.teardown(() => {
		for (const app of apps) {
			app.stop()
		}
	})
	const [app1, ...otherApps] = apps
	// app1 creates a counter
	const { id: counterId } = await app1.actions.createCounter({})

	// app1 has an empty counter
	t.is(await getCounterValue(app1, counterId), 0)

	for (const otherApp of otherApps) {
		// assert the other app does not have a counter
		t.is(await getCounterValue(otherApp, counterId), null)
		// sync the other app
		await app1.messageLog.serve((source) => otherApp.messageLog.sync(source))
		// it should have a counter now
		t.is(await getCounterValue(otherApp, counterId), 0)
	}

	enum Actions {
		Increment,
		Sync,
	}

	// perform some random actions
	for (let i = 0; i < 200; i++) {
		// written this way so that it keeps the typescript literal type
		const selectedAction = enumRandom(Actions)
		if (selectedAction == Actions.Increment) {
			const app = apps[random(apps.length)]
			const beforeValue = await getCounterValue(app, counterId)
			await app.actions.incrementCounter({ id: counterId })
			const afterValue = await getCounterValue(app, counterId)
			t.is(afterValue!, beforeValue! + 1)
		} else if (selectedAction == Actions.Sync) {
			const [sourceApp, targetApp] = arrayRandomN(apps, 2)
			const sourceCounterRecord = await sourceApp.db.get<CounterRecord>("counter", counterId)
			const targetCounterRecord = await targetApp.db.get<CounterRecord>("counter", counterId)
			if (sourceCounterRecord == null) {
				t.fail(`expected source counter value to exist, received null`)
				return
			}
			if (targetCounterRecord == null) {
				t.fail(`expected target counter value to exist, received null`)
				return
			}
			await sourceApp.messageLog.serve((source) => targetApp.messageLog.sync(source))
			const expectedCounterRecord = mergeCounterRecords(sourceCounterRecord, targetCounterRecord)
			const targetCounterRecordAfterSync = await targetApp.db.get<CounterRecord>("counter", counterId)
			if (targetCounterRecordAfterSync == null) {
				t.fail(`expected target counter value to exist, received null`)
				return
			}
			t.is(expectedCounterRecord.id, targetCounterRecordAfterSync.id)
			t.deepEqual(JSON.parse(expectedCounterRecord.value), JSON.parse(targetCounterRecordAfterSync.value))
		}
	}
})
