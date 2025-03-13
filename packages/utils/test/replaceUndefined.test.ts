import test from "ava"

import { replaceUndefined } from "@canvas-js/utils"

test("replace undefined", (t) => {
	t.deepEqual(replaceUndefined(undefined), null)
	t.deepEqual(replaceUndefined([undefined]), [null])
	t.deepEqual(replaceUndefined({ a: 1, b: undefined }), { a: 1, b: null })
	t.deepEqual(replaceUndefined({ a: 1, b: [undefined, { c: undefined }] }), { a: 1, b: [null, { c: null }] })
})
