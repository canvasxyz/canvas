import test from "ava"

import { getQuickJS } from "quickjs-emscripten"
import { VM, assert } from "@canvas-js/vm"

test("wrap a function", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ quickJS })
	t.teardown(() => vm.dispose())

	const handle = vm.wrapFunction((a, b) => {
		assert(typeof a === "number", 'typeof a === "number"')
		assert(typeof b === "number", 'typeof b === "number"')
		return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
	})

	t.teardown(() => handle.dispose())

	const args = [3, 4]
	const result = vm.call(handle, handle, args.map(vm.wrapValue)).consume(vm.unwrapValue)
	t.is(result, 5)
})

test("unwrap a function", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ quickJS })
	t.teardown(() => vm.dispose())

	const fn = vm.get("Math.pow").consume(vm.unwrapFunction)
	t.is(fn(2, 5), Math.pow(2, 5))
})
