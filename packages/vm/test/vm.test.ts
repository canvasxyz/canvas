import test from "ava"

import { CBORValue } from "microcbor"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { getQuickJS } from "quickjs-emscripten"
import {
	VM,
	newUint8Array,
	getUint8Array,
	wrapArray,
	unwrapArray,
	wrapObject,
	unwrapObject,
	mapEntries,
	unwrapCBOR,
	wrapCBOR,
	assert,
	API,
	JSValue,
	callAsync,
	wrapFunction,
	unwrapAsyncFunction,
	get,
} from "@canvas-js/vm"

const contract = `
console.log("hiiiii", bytesToHex(new Uint8Array([1, 2, 3])))
`.trim()

const globalAPI: API = {
	console: { log: (...args) => console.log(...args) },
	bytesToHex: (bytes) => {
		assert(bytes instanceof Uint8Array)
		return bytesToHex(bytes)
	},
	hexToBytes: (bytes) => {
		assert(typeof bytes === "string")
		return hexToBytes(bytes)
	},
}

test("wrap and unwrap an array", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	t.deepEqual(
		wrapArray(vm.context, [vm.context.true, vm.context.false, vm.context.null])
			.consume((handle) => unwrapArray(vm.context, handle))
			.map((handle) => handle.consume(vm.context.dump)),
		[true, false, null]
	)
})

test("wrap and unwrap a Uint8Array", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	const uint8Array = new Uint8Array([1, 2, 3])
	const uint8ArrayHandle = newUint8Array(vm.context, uint8Array)
	t.deepEqual(
		uint8ArrayHandle.consume((handle) => getUint8Array(vm.context, handle)),
		uint8Array
	)
})

test("wrap and unwrap an object", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	const object = { foo: vm.context.true, bar: vm.context.false, baz: vm.context.null }
	t.deepEqual(
		mapEntries(
			wrapObject(vm.context, object).consume((handle) => unwrapObject(vm.context, handle)),
			(key, value) => vm.context.dump(value)
		),
		{ foo: true, bar: false, baz: null }
	)
})

test("wrap and unwrap CBOR values", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	const values: CBORValue[] = [
		null,
		1,
		{},
		[],
		[1, 2, 3, 4],
		{ foo: "hello", bar: "world" },
		Uint8Array.of(1, 2, 3),
		{
			foo: [Uint8Array.of(1), Uint8Array.of(2)],
			bar: [undefined, undefined, undefined],
			baz: [0.1232, Math.PI, NaN],
		},
	]

	for (const value of values) {
		t.deepEqual(
			wrapCBOR(vm.context, value).consume((handle) => unwrapCBOR(vm.context, handle)),
			value
		)
	}
})

test("wrap a function", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	const f = async (a: JSValue, b: JSValue) => {
		assert(typeof a === "number")
		assert(typeof b === "number")
		return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
	}

	const resultHandle = await wrapFunction(vm.context, f).consume((handle) =>
		callAsync(vm.context, handle, vm.context.null, [vm.context.newNumber(3), vm.context.newNumber(4)])
	)

	t.is(resultHandle.consume(vm.context.getNumber), 5)
})

test("unwrap an async function", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())

	const handle = get(vm.context, "Math.pow")
	const f = unwrapAsyncFunction(vm.context, handle)
	t.is(await f(2, 5), Math.pow(2, 5))
})
