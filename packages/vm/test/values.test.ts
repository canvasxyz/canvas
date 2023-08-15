import test from "ava"

import { JSValue, VM } from "@canvas-js/vm"

test("wrap and unwrap primitive values", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const values = [null, true, false, 4, 89.1923, 1392138213321, "hellooo world"]
	for (const value of values) {
		t.is(vm.wrapValue(value).consume(vm.unwrapValue), value)
	}
})

test("wrap and unwrap Uint8Arrays", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const values = [
		new Uint8Array([]),
		new TextEncoder().encode("jfkdlsfjks afjkl ajfk  fjksd fjkldsjfkld jklsf jdkslafjkdsl fjklsd"),
	]

	for (const value of values) {
		t.deepEqual(vm.wrapValue(value).consume(vm.unwrapValue), value)
	}
})

test("wrap and unwrap objects", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const values: JSValue[] = [
		{},
		{ foo: 4, bar: { baz: "nice" } },
		{ x: null, y: Math.PI, z: false },
		{ a: { b: { c: { d: { e: {} } } } } },
	]

	for (const value of values) {
		t.deepEqual(vm.wrapValue(value).consume(vm.unwrapValue), value)
	}
})

test("wrap and unwrap arrays", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const values = [
		[],
		[[], [[]], [[[]]], [[[[]]]]],
		[1, "fjdks", ["hello", "world"], [true, true, false, null, null, "😛"]],
	]

	for (const value of values) {
		t.deepEqual(vm.wrapValue(value).consume(vm.unwrapValue), value)
	}
})
