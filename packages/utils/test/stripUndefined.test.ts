import test from "ava"

import { stripUndefined } from "@canvas-js/utils"

test("strip undefined", (t) => {
	t.deepEqual(stripUndefined({ a: 1, b: undefined }), { a: 1 })
	t.deepEqual(stripUndefined({ a: 1, b: [{ c: undefined, d: undefined }] }), { a: 1, b: [{}] })
	t.deepEqual(stripUndefined({ a: 1, b: [{ d: NaN, e: null, f: undefined }] }), { a: 1, b: [{ d: NaN, e: null }] })
})
