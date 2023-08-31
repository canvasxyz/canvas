import test from "ava"

import { base32 } from "multiformats/bases/base32"

import openMessageLog from "@canvas-js/gossiplog/store"

const validate = (payload: unknown): payload is string => typeof payload === "string"

test("append three messages", async (t) => {
	const topic = "com.example.test"
	const log = await openMessageLog({ location: null, topic, apply: () => {}, validate, signatures: false })

	const { id: foo } = await log.append("foo")
	const { id: bar } = await log.append("bar")
	const { id: baz } = await log.append("baz")

	t.deepEqual(await collect(log.iterate()), [
		[foo, null, { clock: 1, parents: [], payload: "foo" }],
		[bar, null, { clock: 2, parents: [base32.baseDecode(foo)], payload: "bar" }],
		[baz, null, { clock: 3, parents: [base32.baseDecode(bar)], payload: "baz" }],
	])
})

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}

	return values
}
