import test from "ava"

import { VM } from "@canvas-js/vm"

const contract = `
function foo(a, b) {
  return a + b
}

console.log(foo(4, 5))
console.log(foo(6, 7))
`.trim()

test("execute a contract", async (t) => {
	const logs: any[][] = []
	const vm = await VM.initialize({ log: (...args) => logs.push(args) })
	t.teardown(() => vm.dispose())

	vm.execute(contract)
	t.deepEqual(logs, [[9], [13]])
})
