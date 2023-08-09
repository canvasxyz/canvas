// import { QuickJSContext, QuickJSHandle, isFail } from "quickjs-emscripten"
// import { bytesToHex, hexToBytes } from "@noble/hashes/utils"

// import { assert } from "./utils.js"
// import { wrapAPI, call, unwrapError, unwrapResult, resolvePromise, unwrapObject, API } from "./values.js"

// export const globalAPI: API = {
// 	// Database constructor
// 	openDB: () => {},

// 	// Topic handlers
// 	addActionHandler: () => {},
// 	addCustomActionHandler: () => {},

// 	// Utilities
// 	console: { log: (...args) => console.log("[canvas-vm]", ...args) },
// 	assert: (condition, message) => {
// 		assert(typeof condition === "boolean", "assert condition must be a boolean")
// 		assert(message === undefined || typeof message === "string", "assert message must be a string")
// 		assert(condition, message)
// 	},
// 	// fetch: async (url) => {
// 	// 	assert(typeof url === "string", "fetch url must be a string")
// 	// 	return await fetch(url).then((res) => res.text())
// 	// },
// }

// // export async function attachHooks(context: QuickJSContext) {
// // 	{
// // 		const moduleHandle = await loadModule(context, "canvas:modeldb")
// // 		const classHandle = moduleHandle.consume((handle) => context.getProp(handle, "ModelDB"))
// // 		const prototypeHandle = classHandle.consume((handle) => context.getProp(handle, "prototype"))
// // 		prototypeHandle.consume((handle) => {
// // 			wrapAPI(context, {})
// // 			// context.setProp(handle, "fjklsd", context.newFunction())
// // 		})
// // 	}
// // }

// // /**
// //  * Load the exports of a module as an object and return it as a handle.
// //  */
// // export async function loadModule(context: QuickJSContext, moduleName: string): Promise<QuickJSHandle> {
// // 	const moduleResult = context.evalCode(`import("${moduleName}")`)
// // 	const modulePromise = unwrapResult(context, moduleResult)
// // 	try {
// // 		return await resolvePromise(context, modulePromise)
// // 	} finally {
// // 		modulePromise.dispose()
// // 	}
// // }
