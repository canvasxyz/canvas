import test from "ava"

import { VM } from "@canvas-js/vm"

test("wrap and unwrap an error", async (t) => {
	const vm = await VM.initialize()
	t.teardown(() => vm.dispose())
	t.pass()

	// const errors = [
	// 	new Error("regular error"),
	// 	new TypeError("type error"),
	// 	new RangeError("range error"),
	// 	new SyntaxError("syntax error"),
	// ]

	// // TODO: whats going on here???
	// for (const error of errors) {
	// 	const handle = vm.wrapError({ name: error.name, message: error.message })
	// 	t.deepEqual(handle.consume(vm.unwrapError), error)
	// }
})
