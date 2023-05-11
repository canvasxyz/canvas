import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test from "ava"

import * as t from "io-ts"
import { nanoid } from "nanoid"
import { blake3 } from "@noble/hashes/blake3"
import { lessThan } from "@canvas-js/okra"

// import { Store, StoreRecord } from "@canvas-js/store"

// type Token = { v: number; x: Uint8Array }
// type Value = { data: Uint8Array }

// const isUint8Array = (v: unknown): v is Uint8Array => v instanceof Uint8Array
// const uint8ArrayType = new t.Type(
// 	"Uint8Array",
// 	isUint8Array,
// 	(i, context) => (isUint8Array(i) ? t.success(i) : t.failure(i, context)),
// 	t.identity
// )

// const recordType: t.Type<StoreRecord<Token, Value>> = t.type({
// 	token: t.type({ v: t.number, x: uint8ArrayType }),
// 	value: t.union([t.null, t.type({ data: uint8ArrayType })]),
// })

// test("basic store example", async (t) => {
// 	const tmp = path.resolve(os.tmpdir(), nanoid())
// 	t.log(`creating tmp directory ${tmp}`)
// 	fs.mkdirSync(tmp)

// 	t.teardown(() => {
// 		t.log(`removing tmp directory ${tmp}`)
// 		fs.rmSync(tmp, { recursive: true })
// 	})

// 	const store = new Store<Token, Value>(tmp, {
// 		validate: (key, record) => recordType.is(record),
// 		lessThan: (a, b) => (a.v === b.v ? lessThan(a.x, b.x) : a.v < b.v),
// 		getToken: (key, value, previous) => ({
// 			v: previous === null ? 0 : previous.v + 1,
// 			x: blake3(previous?.x ?? new Uint8Array([]), { dkLen: 8 }),
// 		}),
// 	})

// 	const encoder = new TextEncoder()
// 	const e = (text: string) => encoder.encode(text)

// 	await store.set(e("a"), { data: e("foo") })
// 	await store.set(e("b"), { data: e("bar") })
// 	await store.set(e("c"), { data: e("baz") })
// 	await store.delete(e("a"))

// 	t.deepEqual(await store.get(e("a")), null)
// 	t.deepEqual(await store.get(e("b")), { data: e("bar") })
// 	t.deepEqual(await store.get(e("c")), { data: e("baz") })
// })
