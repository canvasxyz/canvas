import test from "ava"

import { getQuickJS } from "quickjs-emscripten"
import { VM, assert, API } from "@canvas-js/vm"

const contract = `
getCurrentTime((timestamp) => console.log("it is currently", new Date(timestamp).toString()))
// getCurrentTime(async (timestamp) => console.log("it is currently", new Date(timestamp).toString()))
getCurrentTime()
`.trim()

const globalAPI: API = {
	console: { log: (...args) => console.log(...args) },
	getCurrentTime: (callback) => {
		console.log("got callback", callback, typeof callback)
		if (callback === undefined) {
			return
		}
		assert(typeof callback === "function", "callback is not a function")
		return callback(Date.now())
	},
}

test("wrap and unwrap a callback", async (t) => {
	const quickJS = await getQuickJS()
	const vm = new VM({ contract, globalAPI, quickJS })
	t.teardown(() => vm.dispose())
	t.pass()
	// const cb = t.is(await f(2, 5), Math.pow(2, 5))
})
