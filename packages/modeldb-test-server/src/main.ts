import { nanoid } from "nanoid"
import { OpfsModelDB, TransientModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import { ModelSchema } from "@canvas-js/modeldb"
import { assert, assertDeepEqual, assertThrown } from "./utils"

class InnerExecutionContext {
	teardownFunction: null | (() => void)
	constructor() {
		this.teardownFunction = null
	}
	is = (value1: any, value2: any, message?: string) => {
		assert(value1 === value2, message)
	}
	deepEqual = (value1: any, value2: any) => {
		assertDeepEqual(value1, value2)
	}
	throwsAsync = async (fn: () => Promise<any>, expected?: { message: string }) => {
		await assertThrown(fn, expected)
	}
	notThrowsAsync = async (fn: () => Promise<any>) => {
		await fn()
	}
	teardown = (fn: () => void) => {
		this.teardownFunction = fn
	}
}

// @ts-ignore
async function openOpfsDB(t: any, models: ModelSchema) {
	// @ts-ignore
	const db = await OpfsModelDB.initialize({
		path: `${nanoid()}.db`,
		models,
	})
	return db
}

// @ts-ignore
async function openTransientDB(t: any, models: ModelSchema) {
	// @ts-ignore
	const db = await TransientModelDB.initialize({
		models,
	})
	return db
}

export const compareUnordered = (t: any, a: any[], b: any[]) => {
	t.is(a.length, b.length)

	const serializedA = a.map((x) => JSON.stringify(x)).sort()
	const serializedB = b.map((x) => JSON.stringify(x)).sort()
	t.deepEqual(serializedA, serializedB)
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}
	return values
}

// // @ts-ignore
// global.OpfsModelDB = OpfsModelDB
// // @ts-ignore
// global.DBWorker = DBWorker
// @ts-ignore
global.nanoid = nanoid
// @ts-ignore
global.InnerExecutionContext = InnerExecutionContext
// @ts-ignore
global.openOpfsDB = openOpfsDB
// @ts-ignore
global.openTransientDB = openTransientDB
// @ts-ignore
global.compareUnordered = compareUnordered
// @ts-ignore
global.collect = collect
