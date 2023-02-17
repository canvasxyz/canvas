import assert from "node:assert"

import { isFail, QuickJSContext, QuickJSHandle, VmCallResult } from "quickjs-emscripten"
import { signalInvalidType } from "../utils.js"

export type JSONValue = null | string | number | boolean | JSONArray | JSONObject
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
	[key: string]: JSONValue
}

const contextCacheMap = new WeakMap<QuickJSContext, Record<string, QuickJSHandle>>()

function getCache(context: QuickJSContext): Record<string, QuickJSHandle> {
	const map = contextCacheMap.get(context)
	if (map === undefined) {
		const initialMap = {}
		contextCacheMap.set(context, initialMap)
		return initialMap
	} else {
		return map
	}
}

export function disposeCachedHandles(context: QuickJSContext) {
	const map = contextCacheMap.get(context)
	if (map !== undefined) {
		for (const [path, handle] of Object.entries(map)) {
			handle.dispose()
			delete map[path]
		}

		contextCacheMap.delete(context) // not really necessary
	}
}

/**
 * get is a utility for accessing global variables inside the QuickJS context.
 * Call it with period-separated paths like "Function.prototype.toString" or "Object.hasOwnProperty".
 */
export function get(context: QuickJSContext, path: string): QuickJSHandle {
	const cache = getCache(context)
	if (path in cache) {
		return cache[path]
	}

	const elements = path.split(".")
	const prop = elements.pop()
	assert(prop !== undefined)

	const object = elements.length > 0 ? get(context, elements.join(".")) : context.global
	const handle = context.getProp(object, prop)
	cache[path] = handle

	return handle
}

export function call(
	context: QuickJSContext,
	fn: string,
	thisArg: null | QuickJSHandle,
	...args: QuickJSHandle[]
): QuickJSHandle {
	const fnHandle = get(context, fn)
	thisArg = thisArg ?? context.null
	const result = context.callFunction(fnHandle, thisArg, ...args)
	if (isFail(result)) {
		console.error("[canvas-core]", result.error.consume(context.dump))
		throw new Error("Interal error: VM.call failed")
	}

	return result.value
}

// // TODO: figure out why quickjs-emscripten doesn't support BigInts
// export function newBigInt(context: QuickJSContext, value: bigint): QuickJSHandle {
// 	return context.newString(value.toString()).consume((handle) => call(context, "BigInt", null, handle))
// }

export function marshalJSONObject(context: QuickJSContext, object: any): QuickJSHandle {
	const i = typeof object
	if (i == "string") {
		return context.newString(object)
	} else if (i == "number") {
		return context.newNumber(object)
	} else if (i == "boolean") {
		return object ? context.true : context.false
	} else if (i == "object") {
		if (object == null) {
			return context.null
		} else {
			const o = context.newObject()
			Object.keys(object).map((key) => {
				context.setProp(o, key, marshalJSONObject(context, object[key]))
			})
			return o
		}
	} else if (i == "undefined") {
		return context.undefined
	} else if (i == "function" || i == "bigint" || i == "symbol") {
		throw Error(`Cannot marshal JSON object to QuickJS: type ${i} is unsupported`)
	} else {
		signalInvalidType(i)
	}
}

/**
 * Wrap an object outside a QuickJS VM by one level,
 * returning a QuickJSHandle in the host environment.
 * Core.wrapObject disposes all of its handle values.
 */
export function wrapObject(context: QuickJSContext, object: Record<string, QuickJSHandle>): QuickJSHandle {
	const objectHandle = context.newObject()
	for (const [key, valueHandle] of Object.entries(object)) {
		context.setProp(objectHandle, key, valueHandle)
		valueHandle.dispose()
	}

	return objectHandle
}

/**
 * Unwrap an object inside a QuickJS VM by one level,
 * returning a Record<string, QuickJSHandle> in the host environment.
 * unwrapObject does NOT dispose of the original handle.
 */
export function unwrapObject(context: QuickJSContext, handle: QuickJSHandle): Record<string, QuickJSHandle> {
	const object: Record<string, QuickJSHandle> = {}
	const keys = call(context, "Object.keys", null, handle).consume((handle) => unwrapArray(context, handle))
	for (const keyHandle of keys) {
		const valueHandle = context.getProp(handle, keyHandle)
		const key = keyHandle.consume(context.getString)
		object[key] = valueHandle
	}

	return object
}

/**
 * Wrap an array outside a QuickJS VM by one level,
 * returning a QuickJSHandle in the host environment.
 * Core.wrapArray disposes all of its handle elements.
 */
export function wrapArray(context: QuickJSContext, array: QuickJSHandle[]): QuickJSHandle {
	const arrayHandle = context.newArray()
	for (const elementHandle of array) {
		call(context, "Array.prototype.push", arrayHandle, elementHandle).dispose()
		elementHandle.dispose()
	}

	return arrayHandle
}

/**
 * Unwrap an array inside a QuickJS VM by one level,
 * returning a QuickJSHandle[] in the host environment.
 * Core.unwrapArray does NOT dispose of the original handle.
 */
export function unwrapArray(context: QuickJSContext, handle: QuickJSHandle): QuickJSHandle[] {
	const length = context.getProp(handle, "length").consume(context.getNumber)
	const array = new Array<QuickJSHandle>(length)
	for (let index = 0; index < length; index++) {
		const indexHandle = context.newNumber(index)
		array[index] = context.getProp(handle, indexHandle)
		indexHandle.dispose()
	}

	return array
}

/**
 * Resolving promises inside QuickJS is tricky because you have to call
 * runtime.executePendingJobs() to get the promise to resolve, so you
 * can't use await syntax even though context.resolvePromise returns a
 * native Promise. This is a utility method that lets you use await.
 */
export async function resolvePromise(
	context: QuickJSContext,
	promise: QuickJSHandle
): Promise<VmCallResult<QuickJSHandle>> {
	return new Promise((resolve, reject) => {
		context.resolvePromise(promise).then(resolve).catch(reject)
		context.runtime.executePendingJobs()
	})
}

/**
 * Load the exports of a module as an object and return it as a handle.
 */
export async function loadModule(
	context: QuickJSContext,
	moduleName: string,
	moduleSource: string
): Promise<QuickJSHandle> {
	context.runtime.setModuleLoader((name) => {
		if (name === moduleName) {
			return moduleSource
		} else {
			throw new Error("module imports are not allowed")
		}
	})

	wrapObject(context, {
		customAction: context.newFunction("customAction", (schema, fn) => {
			// Create a new object within the vm that stores the schema and action function
			const actionObject = context.newObject()
			context.setProp(actionObject, "fn", fn || context.undefined)
			context.setProp(actionObject, "schema", schema || context.undefined)
			return actionObject
		}),
	}).consume((globalsHandle) => call(context, "Object.assign", null, context.global, globalsHandle).dispose())

	const moduleResult = context.evalCode(`import("${moduleName}")`)
	const modulePromise = context.unwrapResult(moduleResult)
	const moduleExports = await resolvePromise(context, modulePromise).then(context.unwrapResult)
	modulePromise.dispose()
	context.runtime.removeModuleLoader()
	return moduleExports
}
/**
 * composes external JSON.stringify with internal JSON.parse
 * @param jsonValue any JSON value
 * @returns a QuickJS handle
 */
export function wrapJSON(context: QuickJSContext, jsonValue: JSONValue): QuickJSHandle {
	return context
		.newString(JSON.stringify(jsonValue))
		.consume((stringHandle) => call(context, "JSON.parse", null, stringHandle))
}

/**
 * composes internal JSON.stringify with external JSON.parse
 * @param handle a QuickJS handle of a JSON value
 * @returns the unwrapped JSON value
 */
export function unwrapJSON(context: QuickJSContext, handle: QuickJSHandle): JSONValue {
	return JSON.parse(call(context, "JSON.stringify", null, handle).consume(context.getString))
}
