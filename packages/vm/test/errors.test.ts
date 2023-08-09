import test from "ava"

import { getQuickJS } from "quickjs-emscripten"
import { VM, assert } from "@canvas-js/vm"

test("wrap and unwrap an error", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ quickJS })
	t.teardown(() => vm.dispose())

	const errors = [
		new Error("regular error"),
		new TypeError("type error"),
		new RangeError("range error"),
		new SyntaxError("syntax error"),
	]

	// TODO: whats going on here???
	for (const error of errors) {
		const handle = vm.wrapError(error)
		// console.log("got wrapped error", vm.context.dump(handle), handle.alive)
		t.deepEqual(vm.unwrapError(handle), error)
	}
})
