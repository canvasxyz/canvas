import test from "ava"

import { merge } from "../src/index.js"

test("merging non-objects always overwrites the receiving value", async (t) => {
	t.deepEqual(merge([1, 2, 3], [4, 5, 6]), [1, 2, 3])
	t.deepEqual(merge(null, [4, 5, 6]), null)
	t.deepEqual(merge("foo", [4, 5, 6]), "foo")
	t.deepEqual(merge(-89, [4, 5, 6]), -89)
	t.deepEqual(merge(Infinity, [4, 5, 6]), Infinity)
	t.deepEqual(merge([[], [[]], [[[]]], [[[[]]]]], [4, 5, 6]), [[], [[]], [[[]]], [[[[]]]]])
	t.deepEqual(merge(1, null), 1)
	t.deepEqual(merge(null, 2), null)
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
