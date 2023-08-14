import assert from "node:assert"
import test from "ava"

import { VM } from "@canvas-js/vm"

test("wrap a function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction((a, b) => {
		assert(typeof a === "number", 'typeof a === "number"')
		assert(typeof b === "number", 'typeof b === "number"')
		return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
	})

	t.teardown(() => handle.dispose())

	const args = [3, 4].map(vm.wrapValue)
	const result = vm.call(handle, handle, args).consume(vm.unwrapValue)
	t.is(result, 5)
})

test("wrap a function that allocates on the heap", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction((a, b) => {
		return { a, b }
	})

	t.teardown(() => handle.dispose())

	const args = [{ foo: 3 }, { bar: 4 }].map(vm.wrapValue)
	t.teardown(() => args.forEach((arg) => arg.dispose()))

	const result = vm.call(handle, handle, args).consume(vm.unwrapValue)
	t.deepEqual(result, { a: { foo: 3 }, b: { bar: 4 } })
})

test("unwrap a function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const f = vm.unwrapFunction(vm.get("Math.pow"))
	t.is(f(2, 5), Math.pow(2, 5))
})

test("unwrap a function that allocates on the heap", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const f = vm.unwrapFunction(vm.get("Object.keys"))
	t.deepEqual(f({ foo: 1, bar: 2 }), ["foo", "bar"])
})

test("call an async function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const result = await vm.callAsync("Promise.resolve", "Promise", [vm.wrapValue(4)])
	t.is(result.consume(vm.unwrapValue), 4)
})

test("call an async function that allocates on the heap", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const args = [vm.wrapValue([1, 2, 3])]
	t.teardown(() => args.forEach((arg) => arg.dispose()))

	const result = await vm.callAsync("Promise.resolve", "Promise", args)
	t.deepEqual(result.consume(vm.unwrapValue), [1, 2, 3])
})

test("wrap an async function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction((value) => Promise.resolve(value))
	t.teardown(() => handle.dispose())

	const args = [vm.wrapValue("wow")]
	t.teardown(() => args.forEach((arg) => arg.dispose()))

	const result = await vm.callAsync(handle, handle, args)
	t.deepEqual(result.consume(vm.unwrapValue), "wow")
})

test("wrap an async function that allocates on the heap", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction(async (value) => {
		assert(Array.isArray(value), "expected array")
		return value.map((value) => value?.toString())
	})

	t.teardown(() => handle.dispose())

	const args = [vm.wrapValue([1, 2, 3])]
	t.teardown(() => args.forEach((arg) => arg.dispose()))

	const result = await vm.callAsync(handle, handle, args)
	t.deepEqual(result.consume(vm.unwrapValue), ["1", "2", "3"])

	t.pass()
})

test("unwrap an async function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const f = vm.unwrapFunctionAsync(vm.get("Promise.resolve"), vm.get("Promise"))
	t.deepEqual(await f({ value: "lol" }), { value: "lol" })
})

test("wrap and unwrap a function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const f = vm.wrapFunction((...args) => args.join("")).consume(vm.unwrapFunction)
	t.is(f("a", "b", "c"), "abc")
})

test("wrap and unwrap an async function", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction(async (...args) => args.join(""))
	const f = handle.consume(vm.unwrapFunctionAsync)
	t.deepEqual(await f("a", "b", "c"), "abc")
})

test("wrap and unwrap an async function that allocations on the heap", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction(async (...args) => ({ result: args.join("") }))
	const f = handle.consume(vm.unwrapFunctionAsync)
	t.deepEqual(await f("a", "b", "c"), { result: "abc" })
})
