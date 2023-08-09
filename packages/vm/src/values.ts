import { QuickJSContext, QuickJSHandle, VmCallResult, isFail } from "quickjs-emscripten"

import type { CBORValue } from "microcbor"

import { mapEntries, get } from "./utils.js"

/**
 * Call a function in the global scope
 */
export function call(
	context: QuickJSContext,
	fn: string | QuickJSHandle,
	thisArg: string | QuickJSHandle,
	args: QuickJSHandle[]
): QuickJSHandle {
	const result = context.callFunction(
		typeof fn === "string" ? get(context, fn) : fn,
		typeof thisArg === "string" ? get(context, thisArg) : thisArg,
		...args
	)
	return unwrapResult(context, result)
}

export function callAsync(
	context: QuickJSContext,
	fn: string | QuickJSHandle,
	thisArg: string | QuickJSHandle,
	args: QuickJSHandle[]
): Promise<QuickJSHandle> {
	const promiseHandle = call(context, fn, thisArg, args)
	return promiseHandle.consume((handle) => resolvePromise(context, handle))
	// const promise = call(context, fn, thisArg, args).consume((handle) =>
	// 	call(context, "Promise.resolve", "Promise", [handle])
	// )

	// return promise.consume((handle) => resolvePromise(context, handle))
}

export function assign(context: QuickJSContext, target: QuickJSHandle, source: QuickJSHandle) {
	call(context, "Object.assign", context.null, [target, source]).dispose()
}

/**
 * Wrap an object outside a QuickJS VM by one level,
 * returning a QuickJSHandle in the host environment.
 * Core.wrapObject disposes all of its handle values.
 */
export function wrapObject(context: QuickJSContext, object: Record<string, QuickJSHandle>): QuickJSHandle {
	const objectHandle = context.newObject()
	for (const [key, valueHandle] of Object.entries(object)) {
		valueHandle.consume((handle) => context.setProp(objectHandle, key, handle))
	}

	return objectHandle
}

/**
 * Unwrap an object inside a QuickJS VM by one level,
 * returning a Record<string, QuickJSHandle> in the host environment.
 * unwrapObject does NOT dispose of the original handle.
 */
export function unwrapObject<T = QuickJSHandle>(
	context: QuickJSContext,
	handle: QuickJSHandle,
	map?: (propertyHandle: QuickJSHandle) => T
): Record<string, T> {
	const object: Record<string, T> = {}
	const keys = call(context, "Object.keys", context.null, [handle]).consume((handle) => unwrapArray(context, handle))
	for (const keyHandle of keys) {
		const valueHandle = context.getProp(handle, keyHandle)
		const key = keyHandle.consume(context.getString)
		if (map === undefined) {
			object[key] = valueHandle as T
		} else {
			object[key] = map(valueHandle)
		}
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
		call(context, "Array.prototype.push", arrayHandle, [elementHandle]).dispose()
		elementHandle.dispose()
	}

	return arrayHandle
}

/**
 * Unwrap an array inside a QuickJS VM by one level,
 * returning a QuickJSHandle[] in the host environment.
 * Core.unwrapArray does NOT dispose of the original handle.
 */
export function unwrapArray<T = QuickJSHandle>(
	context: QuickJSContext,
	handle: QuickJSHandle,
	map?: (elementHandle: QuickJSHandle) => T
): T[] {
	const length = context.getProp(handle, "length").consume(context.getNumber)
	const array = new Array<T>(length)
	for (let index = 0; index < length; index++) {
		const elementHandle = context.newNumber(index).consume((indexHandle) => context.getProp(handle, indexHandle))
		if (map === undefined) {
			array[index] = elementHandle as T
		} else {
			array[index] = map(elementHandle)
		}
	}

	return array
}

export function unwrapError(context: QuickJSContext, errorHandle: QuickJSHandle): Error {
	const errorValue = errorHandle.consume(context.dump)
	if (typeof errorValue === "object" && typeof errorValue.message === "string") {
		let error: Error
		if (errorValue.name === "SyntaxError") {
			error = new SyntaxError(errorValue.message)
		} else if (errorValue.name === "TypeError") {
			error = new TypeError(errorValue.message)
		} else if (errorValue.name === "RangeError") {
			error = new RangeError(errorValue.message)
		} else {
			error = new Error(errorValue.message)
		}

		return error
	} else {
		throw errorValue
	}
}

export function unwrapResult(context: QuickJSContext, result: VmCallResult<QuickJSHandle>): QuickJSHandle {
	if (isFail(result)) {
		throw unwrapError(context, result.error)
	} else {
		return result.value
	}
}

/**
 * Resolving promises inside QuickJS is tricky because you have to call
 * runtime.executePendingJobs() to get the promise to resolve, so you
 * can't use await syntax even though context.resolvePromise returns a
 * native Promise. This is a utility method that lets you use await.
 */
export function resolvePromise(context: QuickJSContext, promise: QuickJSHandle): Promise<QuickJSHandle> {
	return new Promise((resolve, reject) => {
		context
			.resolvePromise(promise)
			.then((result) => resolve(unwrapResult(context, result)))
			.catch(reject)

		context.runtime.executePendingJobs()
	})
}

/**
 * An API is a nested object of functions
 */
export interface API {
	[key: string]: APIMethod | API
}

export type APIMethod = (...args: JSValue[]) => void | JSValue | Promise<void | JSValue>

// export function wrapAPIMethod(context: QuickJSContext, fn: APIMethod): QuickJSHandle {
// 	return context.newFunction(fn.name, (...argHandles: QuickJSHandle[]) => {
// 		const args = argHandles.map((handle) => unwrapValue(context, handle))
// 		const result = fn(...args)
// 		if (result instanceof Promise) {
// 			const deferred = context.newPromise()
// 			result.then((value) => {
// 				const resultHandle = value === undefined ? context.undefined : wrapValue(context, value)
// 				deferred.settled.then(() => context.runtime.executePendingJobs()).finally(() => resultHandle.dispose())
// 				deferred.resolve(resultHandle)
// 			})

// 			return deferred.handle
// 		} else {
// 			return result === undefined ? context.undefined : wrapValue(context, result)
// 		}
// 	})
// }

export function wrapAPI(context: QuickJSContext, api: API): QuickJSHandle {
	return wrapObject(
		context,
		mapEntries(api, (key, value) =>
			// typeof value === "function" ? wrapAPIMethod(context, value) : wrapAPI(context, value)
			typeof value === "function" ? wrapFunction(context, value) : wrapAPI(context, value)
		)
	)
}

export const getBoolean = (context: QuickJSContext, handle: QuickJSHandle) => Boolean(context.getNumber(handle))

export function newUint8Array(context: QuickJSContext, value: Uint8Array): QuickJSHandle {
	return wrapArray(
		context,
		Array.from(value).map((byte) => context.newNumber(byte))
	).consume((handle) => call(context, "Uint8Array.from", "Uint8Array", [handle]))
}

export function getUint8Array(context: QuickJSContext, handle: QuickJSHandle): Uint8Array {
	return Uint8Array.from(call(context, "Array.from", "Array", [handle]).consume(context.dump))
}

export function wrapCBOR(context: QuickJSContext, value: CBORValue): QuickJSHandle {
	if (value === undefined) {
		return context.undefined
	} else if (value === null) {
		return context.null
	} else if (typeof value === "boolean") {
		return value ? context.true : context.false
	} else if (typeof value === "number") {
		return context.newNumber(value)
	} else if (typeof value === "string") {
		return context.newString(value)
	} else if (value instanceof Uint8Array) {
		return newUint8Array(context, value)
	} else if (Array.isArray(value)) {
		return wrapArray(
			context,
			value.map((element) => wrapCBOR(context, element))
		)
	} else {
		return wrapObject(
			context,
			mapEntries(value, (key, value) => wrapCBOR(context, value))
		)
	}
}

const is = (context: QuickJSContext, a: QuickJSHandle, b: QuickJSHandle): boolean =>
	call(context, "Object.is", context.null, [a, b]).consume(context.dump)

const isArray = (context: QuickJSContext, handle: QuickJSHandle): boolean =>
	context.typeof(handle) === "object" && call(context, "Array.isArray", context.null, [handle]).consume(context.dump)

const isUint8Array = (context: QuickJSContext, handle: QuickJSHandle): boolean =>
	context.typeof(handle) === "object" &&
	context
		.getProp(handle, "constructor")
		.consume((constructorHandle) => is(context, constructorHandle, get(context, "Uint8Array")))

export function unwrapCBOR(context: QuickJSContext, handle: QuickJSHandle): CBORValue {
	if (context.typeof(handle) === "undefined") {
		return undefined
	} else if (is(context, handle, context.null)) {
		return null
	} else if (context.typeof(handle) === "boolean") {
		return getBoolean(context, handle)
	} else if (context.typeof(handle) === "number") {
		return context.getNumber(handle)
	} else if (context.typeof(handle) === "string") {
		return context.getString(handle)
	} else if (isUint8Array(context, handle)) {
		return getUint8Array(context, handle)
	} else if (isArray(context, handle)) {
		return unwrapArray(context, handle, (elementHandle) =>
			elementHandle.consume((handle) => unwrapCBOR(context, handle))
		)
	} else {
		return unwrapObject(context, handle, (propertyHandle) =>
			propertyHandle.consume((handle) => unwrapCBOR(context, handle))
		)
	}
}

/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl
/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl
/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl
/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl/// fjkldsa jfkldsa jfkldsa jfklads; jfkasdl

export type JSValue = undefined | null | boolean | number | string | Uint8Array | JSArray | JSObject | JSFunction
export type JSFunction = (...args: JSValue[]) => void | JSValue | Promise<void | JSValue>
export interface JSArray extends Array<JSValue> {}
export interface JSObject {
	[key: string]: JSValue
}

export function typeOf(value: JSValue) {
	if (value === undefined) {
		return "undefined"
	} else if (value === null) {
		return "null"
	} else if (typeof value === "boolean") {
		return "boolean"
	} else if (typeof value === "number") {
		return "number"
	} else if (typeof value === "string") {
		return "string"
	} else if (value instanceof Uint8Array) {
		return "Uint8Array"
	} else if (typeof value === "function") {
		return "function"
	} else if (Array.isArray(value)) {
		return "Array"
	} else {
		return "Object"
	}
}

export const isObject = (value: JSValue): value is JSObject => typeOf(value) === "Object"

export function wrapValue(context: QuickJSContext, value: JSValue): QuickJSHandle {
	if (value === undefined) {
		return context.undefined
	} else if (value === null) {
		return context.null
	} else if (typeof value === "boolean") {
		return value ? context.true : context.false
	} else if (typeof value === "number") {
		return context.newNumber(value)
	} else if (typeof value === "string") {
		return context.newString(value)
	} else if (value instanceof Uint8Array) {
		return newUint8Array(context, value)
	} else if (typeof value === "function") {
		return wrapFunction(context, value)
	} else if (Array.isArray(value)) {
		return wrapArray(
			context,
			value.map((element) => wrapValue(context, element))
		)
	} else {
		return wrapObject(
			context,
			mapEntries(value, (key, value) => wrapValue(context, value))
		)
	}
}

export function unwrapValue(context: QuickJSContext, handle: QuickJSHandle): JSValue {
	if (context.typeof(handle) === "undefined") {
		return undefined
	} else if (is(context, handle, context.null)) {
		return null
	} else if (context.typeof(handle) === "boolean") {
		return getBoolean(context, handle)
	} else if (context.typeof(handle) === "number") {
		return context.getNumber(handle)
	} else if (context.typeof(handle) === "string") {
		return context.getString(handle)
	} else if (isUint8Array(context, handle)) {
		return getUint8Array(context, handle)
	} else if (context.typeof(handle) === "function") {
		return async (...args: JSValue[]) => {
			const argHandles = args.map((arg) => wrapValue(context, arg))
			const result = await callAsync(context, handle, handle, argHandles)
			return result.consume((handle) => unwrapValue(context, handle))
		}
	} else if (isArray(context, handle)) {
		return unwrapArray(context, handle, (elementHandle) =>
			elementHandle.consume((handle) => unwrapValue(context, handle))
		)
	} else {
		return unwrapObject(context, handle, (propertyHandle) =>
			propertyHandle.consume((handle) => unwrapValue(context, handle))
		)
	}
}

export function unwrapAsyncFunction(
	context: QuickJSContext,
	fn: QuickJSHandle
): (...args: JSValue[]) => Promise<void | JSValue> {
	return async (...args) => {
		const argHandles = args.map((arg) => wrapValue(context, arg))
		try {
			const result = await callAsync(context, fn, fn, argHandles)
			return result.consume((handle) => unwrapValue(context, handle))
		} finally {
			argHandles.forEach((handle) => handle.dispose())
		}
	}
}

export function wrapFunction(context: QuickJSContext, fn: JSFunction): QuickJSHandle {
	console.log("wrapping function", fn)
	return context.newFunction(fn.name, (...argHandles: QuickJSHandle[]) => {
		const args = argHandles.map((handle) => unwrapValue(context, handle))
		const result = fn(...args)
		if (result instanceof Promise) {
			const deferred = context.newPromise()
			deferred.settled.then(() => context.runtime.executePendingJobs())
			result
				.then((value) => {
					console.log("resolved result", deferred.alive, deferred.handle.alive)
					deferred.resolve(wrapValue(context, value as JSValue))
				})
				.catch((err) => {
					console.error("FJDKSLFJDKSL", err)
				})
			return deferred.handle
		} else {
			return result === undefined ? context.undefined : wrapValue(context, result)
		}
	})
}
