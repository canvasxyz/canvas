import test from "ava"

import { merge } from "@canvas-js/modeldb"

test("merging non-objects always overwrites the receiving value", async (t) => {
	t.deepEqual(merge({ a: [1, 2, 3] }, { a: [4, 5, 6] }), { a: [1, 2, 3] })
	t.deepEqual(merge({ a: null }, { a: [4, 5, 6] }), { a: null })
	t.deepEqual(merge({ a: "foo" }, { a: [4, 5, 6] }), { a: "foo" })
	t.deepEqual(merge({ a: -89 }, { a: [4, 5, 6] }), { a: -89 })
	t.deepEqual(merge({ a: Infinity }, { a: [4, 5, 6] }), { a: Infinity })
	t.deepEqual(merge({ a: [[], [[]], [[[]]], [[[[]]]]] }, { a: [4, 5, 6] }), { a: [[], [[]], [[[]]], [[[[]]]]] })
	t.deepEqual(merge({ a: 1 }, { a: null }), { a: 1 })
	t.deepEqual(merge({ a: null }, { a: 2 }), { a: null })
})

test("merging objects overwrites fields in the object", async (t) => {
	t.deepEqual(merge({ a: [1, 2, 3] }, { b: [4, 5, 6] }), { a: [1, 2, 3], b: [4, 5, 6] })
	t.deepEqual(merge({ a: null, b: -89, c: Infinity }, { b: [4, 5, 6], c: "string", d: 1 }), {
		a: null,
		b: -89,
		c: Infinity,
		d: 1,
	})
	t.deepEqual(merge({ a: 1, b: { c: {}, e: "f" } }, { a: { b: 2 }, b: { c: 1, d: {} } }), {
		a: 1,
		b: { c: {}, d: {}, e: "f" },
	})
	t.deepEqual(merge({ a: { b: { c: { d: { e: {} } } } } }, { a: { c: {} }, b: { c: { d: {}, e: {} } } }), {
		a: { b: { c: { d: { e: {} } } }, c: {} },
		b: { c: { d: {}, e: {} } },
	})
})
