import { nanoid } from "nanoid"
import { ModelDB } from "@canvas-js/modeldb-sqlite-wasm"
import { ModelSchema } from "@canvas-js/modeldb"
import { assert, assertDeepEqual, assertThrown } from "./utils.js"

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
	const db = await ModelDB.initialize({
		path: `${nanoid()}.db`,
		models,
	})
	return db
}

// @ts-ignore
async function openTransientDB(t: any, models: ModelSchema) {
	// @ts-ignore
	const db = await ModelDB.initialize({
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

const MAX_BYTES = 65536
const MAX_UINT32 = 4294967295

function randomBytes(size: number, cb: (err: Error | null, buf: Buffer) => void): Buffer | void {
	// phantomjs needs to throw
	if (size > MAX_UINT32) throw new RangeError("requested too many random bytes")

	const bytes = Buffer.allocUnsafe(size)

	if (size > 0) {
		// getRandomValues fails on IE if size == 0
		if (size > MAX_BYTES) {
			// this is the max bytes crypto.getRandomValues
			// can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
			for (let generated = 0; generated < size; generated += MAX_BYTES) {
				// buffer.slice automatically checks if the end is past the end of
				// the buffer so we don't have to here
				crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES))
			}
		} else {
			crypto.getRandomValues(bytes)
		}
	}

	if (typeof cb === "function") {
		return process.nextTick(function () {
			cb(null, bytes)
		})
	}

	return bytes
}

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
// @ts-ignore
global.randomBytes = randomBytes
