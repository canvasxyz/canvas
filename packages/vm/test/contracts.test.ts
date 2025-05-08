import { randomUUID } from "node:crypto"
import test from "ava"

import { VM } from "@canvas-js/vm"
import { JSModuleLoader } from "quickjs-emscripten"

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

	const exports = vm.import(contractModule).consume(vm.context.dump)
	t.deepEqual(exports, { x: "hello world", y: { foo: "bar" }, z: 5 })
})

test("isClass", async (t) => {
	const classModule = `
    export class Foo {
      constructor(bar) {
        console.log("neat!")
        this.bar = bar
      }
    }

    export function Bar() {}

    export const Baz = () => {}
  `.trim()

	const vm = await VM.initialize({})
	t.teardown(() => vm.dispose())

	using exportsHandle = vm.import(classModule)
	using fooHandle = vm.context.getProp(exportsHandle, "Foo")
	using barHandle = vm.context.getProp(exportsHandle, "Bar")
	using bazHandle = vm.context.getProp(exportsHandle, "Baz")

	t.is(vm.context.typeof(fooHandle), "function")
	t.is(vm.context.typeof(barHandle), "function")
	t.is(vm.context.typeof(bazHandle), "function")

	t.true(vm.isClass(fooHandle))
	// t.true(!vm.isClass(barHandle))
	// t.true(!vm.isClass(bazHandle))
})

const defaultExportModule = `
  export default class MyApp {
    static baz = "hello world"
    constructor(bar) {
      console.log("neat!")
      this.bar = bar
    }

    qux() {
      return ++this.bar;
    }
  }
`.trim()

test("default export a class", async (t) => {
	const vm = await VM.initialize({})
	t.teardown(() => vm.dispose())

	using exportsHandle = vm.import(defaultExportModule)
	using classHandle = vm.context.getProp(exportsHandle, "default")

	t.is(vm.context.typeof(classHandle), "function")
	t.true(vm.isClass(classHandle))
})

test("import and construct a class", async (t) => {
	const vm = await VM.initialize({})
	t.teardown(() => vm.dispose())

	const moduleId = randomUUID()

	vm.runtime.setModuleLoader((moduleName, context) => {
		if (moduleName === moduleId) {
			return defaultExportModule
		} else {
			return { error: new Error(`module "${moduleName}" not found`) }
		}
	})

	using exportsHandle = vm.import(`
	  import Class from "${moduleId}"
		const createClass = (...args) => new Class(...args)
		export { Class, createClass }
	`)

	using classHandle = vm.context.getProp(exportsHandle, "Class")
	using createClassHandle = vm.context.getProp(exportsHandle, "createClass")

	t.true(vm.isClass(classHandle))
	t.is(vm.context.typeof(createClassHandle), "function")

	using instanceHandle = vm.call(createClassHandle, vm.context.null, [vm.context.newNumber(10)])
	t.true(vm.isInstanceOf(instanceHandle, classHandle))

	using barHandle = vm.context.getProp(instanceHandle, "bar")
	t.is(vm.context.getNumber(barHandle), 10)

	using bazHandle = vm.context.getProp(classHandle, "baz")
	t.is(vm.context.getString(bazHandle), "hello world")

	const result = vm.context
		.getProp(instanceHandle, "qux")
		.consume((handle) => vm.call(handle, instanceHandle, []))
		.consume((handle) => vm.context.getNumber(handle))
	t.is(result, 11)
})
