import test from "ava"

import { VM } from "@canvas-js/vm"

test("wrap and unwrap an error", async (t) => {
	const vm = await VM.initialize()
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
		t.deepEqual(handle.consume(vm.unwrapError), error)
	}
})
