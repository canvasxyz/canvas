import test from "ava"

import { prepare, JSValue } from "@canvas-js/utils"

test("prepare values, objects, Uint8Arrays, nested arrays", async (t) => {
	const arr1 = [null, true, false, 4, 89.1923, 1392138213321, -0.0, Infinity, -Infinity, NaN, "hellooo world", ""]
	const arr2 = [
		new Uint8Array([]),
		new TextEncoder().encode("jfkdlsfjks afjkl ajfk  fjksd fjkldsjfkld jklsf jdkslafjkdsl fjklsd"),
	]
	const arr3: JSValue[] = [
		{},
		{ foo: 4, bar: { baz: "nice" } },
		{ x: null, y: Math.PI, z: false },
		{ a: { b: { c: { d: { e: {} } } } } },
	]
	const arr4 = [
		[],
		[[], [[]], [[[]]], [[[[]]]]],
		[1, "fjdks", ["hello", "world"], [true, true, false, null, null, "😛"]],
	]

	t.deepEqual(prepare(arr1), arr1)
	t.deepEqual(prepare(arr2), arr2)
	t.deepEqual(prepare(arr3), arr3)
	t.deepEqual(prepare(arr4), arr4)
	t.deepEqual(prepare({ arr1, arr2, arr3, arr4 }), { arr1, arr2, arr3, arr4 })
})

test("prepare filters out undefined in objects", async (t) => {
	t.deepEqual(prepare({ a: "foo", b: undefined }), { a: "foo" })
	t.deepEqual(prepare({ a: "foo", b: { c: undefined } }), { a: "foo", b: {} })
})

test("prepare rejects undefined in arrays", async (t) => {
	t.notThrowsAsync(async () => prepare([]))
	t.throwsAsync(async () => prepare([undefined]))
	t.throwsAsync(async () => prepare([1, 2, undefined]))
	t.throwsAsync(async () => prepare({ a: 1, b: [undefined] }))
})

test("prepare({ replaceUndefined: true }) replaces undefined in arrays and at the root", async (t) => {
	t.deepEqual(prepare([undefined], { replaceUndefined: true }), [null])
	t.deepEqual(prepare(undefined, { replaceUndefined: true }), null)
	t.deepEqual(prepare({ a: 1, b: [undefined] }, { replaceUndefined: true }), { a: 1, b: [null] })
})
