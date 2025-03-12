import test from "ava"

import { mergeModelValue } from "@canvas-js/modeldb"

test("merging non-objects always overwrites the receiving value", async (t) => {
	t.deepEqual(mergeModelValue({ a: [1, 2, 3] }, { a: [4, 5, 6] }), { a: [1, 2, 3] })
	t.deepEqual(mergeModelValue({ a: null }, { a: [4, 5, 6] }), { a: null })
	t.deepEqual(mergeModelValue({ a: "foo" }, { a: [4, 5, 6] }), { a: "foo" })
	t.deepEqual(mergeModelValue({ a: -89 }, { a: [4, 5, 6] }), { a: -89 })
	t.deepEqual(mergeModelValue({ a: Infinity }, { a: [4, 5, 6] }), { a: Infinity })
	t.deepEqual(mergeModelValue({ a: [[], [[]], [[[]]], [[[[]]]]] }, { a: [4, 5, 6] }), {
		a: [[], [[]], [[[]]], [[[[]]]]],
	})
	t.deepEqual(mergeModelValue({ a: 1 }, { a: null }), { a: 1 })
	t.deepEqual(mergeModelValue({ a: null }, { a: 2 }), { a: null })
})

test("merging objects overwrites fields in the object", async (t) => {
	t.deepEqual(mergeModelValue({ a: [1, 2, 3] }, { b: [4, 5, 6] }), { a: [1, 2, 3], b: [4, 5, 6] })
	t.deepEqual(mergeModelValue({ a: null, b: -89, c: Infinity }, { b: [4, 5, 6], c: "string", d: 1 }), {
		a: null,
		b: -89,
		c: Infinity,
		d: 1,
	})
	t.deepEqual(mergeModelValue({ a: 1, b: { c: {}, e: "f" } }, { a: { b: 2 }, b: { c: 1, d: {} } }), {
		a: 1,
		b: { c: {}, d: {}, e: "f" },
	})
	t.deepEqual(mergeModelValue({ a: { b: { c: { d: { e: {} } } } } }, { a: { c: {} }, b: { c: { d: {}, e: {} } } }), {
		a: { b: { c: { d: { e: {} } } }, c: {} },
		b: { c: { d: {}, e: {} } },
	})
})
