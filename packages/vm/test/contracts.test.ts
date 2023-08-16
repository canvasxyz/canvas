import test from "ava"

import { VM } from "@canvas-js/vm"

const contractScript = `
function foo(a, b) {
  return a + b;
}

console.log(foo(4, 5));
console.log(foo(6, 7));
`.trim()

test("execute a script", async (t) => {
	const logs: any[][] = []
	const vm = await VM.initialize({ log: (...args) => logs.push(args) })
	t.teardown(() => vm.dispose())
	vm.execute(contractScript)
	t.deepEqual(logs, [[9], [13]])
})

const contractModule = `
export const x = "hello world";
export const y = { foo: "bar" };

function foo(a, b) {
	return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
}

export const z = foo(3, 4);
`.trim()

test("import a module", async (t) => {
	const logs: any[][] = []
	const vm = await VM.initialize({ log: (...args) => logs.push(args) })
	t.teardown(() => vm.dispose())

	const exports = await vm.import(contractModule).then((handle) => handle.consume(vm.context.dump))
	t.deepEqual(exports, { x: "hello world", y: { foo: "bar" }, z: 5 })
})
