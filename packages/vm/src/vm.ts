import {
	QuickJSContext,
	QuickJSHandle,
	QuickJSRuntime,
	QuickJSWASMModule,
	VmCallResult,
	getQuickJS,
	isFail,
} from "quickjs-emscripten"
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from "@noble/hashes/sha256"
import { logger } from "@libp2p/logger"

import { Awaitable } from "@canvas-js/interfaces"
import { JSValue, assert } from "@canvas-js/utils"

export type JSFunction = (...args: JSValue[]) => undefined | JSValue
export type JSFunctionAsync = (...args: JSValue[]) => Promise<undefined | JSValue>

import { VMError } from "./error.js"

export interface VMOptions {
	log?: (...args: JSValue[]) => void
	runtimeMemoryLimit?: number
}

export class VM {
	public static RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb
	public static getFileURI = (file: string) => `canvas:${bytesToHex(sha256(file))}`

	private readonly log = logger("canvas:vm")

	readonly #globalCache = new Map<string, QuickJSHandle>()
	readonly #localCache = new Set<QuickJSHandle>()

	public static async initialize(options: VMOptions = {}): Promise<VM> {
		const quickJS = await getQuickJS()
		return new VM(quickJS, options)
	}

	public readonly runtime: QuickJSRuntime
	public readonly context: QuickJSContext

	private constructor(quickJS: QuickJSWASMModule, options: VMOptions) {
		this.runtime = quickJS.newRuntime()
		this.context = this.runtime.newContext()

		const runtimeMemoryLimit = options.runtimeMemoryLimit ?? VM.RUNTIME_MEMORY_LIMIT
		this.runtime.setMemoryLimit(runtimeMemoryLimit)

		const log = options.log ?? ((...args) => console.log("[vm]", ...args))

		this.setGlobalValues({
			console: this.wrapObject({ log: this.wrapFunction((...args) => void log(...args)) }),
		})
	}

	/**
	 * Cleans up this VM instance.
	 */
	public dispose() {
		for (const [path, handle] of this.#globalCache) {
			handle.dispose()
			this.#globalCache.delete(path)
		}

		for (const handle of this.#localCache) {
			handle.dispose()
			this.#localCache.delete(handle)
		}

		this.context.dispose()
		this.runtime.dispose()
	}

	public setGlobalValues(values: Record<string, QuickJSHandle>) {
		for (const [name, handle] of Object.entries(values)) {
			handle.consume((handle) => this.context.setProp(this.context.global, name, handle))
		}
	}

	public execute(script: string, options: { uri?: string } = {}) {
		const filename = options.uri ?? VM.getFileURI(script)
		this.unwrapResult(this.context.evalCode(script, filename, { type: "global", strict: true })).dispose()
	}

	public import(module: string, options: { uri?: string } = {}): QuickJSHandle {
		const filename = options.uri ?? VM.getFileURI(module)
		return this.unwrapResult(this.context.evalCode(module, filename, { type: "module", strict: true }))
	}

	public get = (path: string): QuickJSHandle => {
		const cachedHandle = this.#globalCache.get(path)
		if (cachedHandle !== undefined) {
			return cachedHandle
		}

		const elements = path.split(".")
		const prop = elements.pop()
		assert(prop !== undefined)

		const object = elements.length > 0 ? this.get(elements.join(".")) : this.context.global
		const handle = this.context.getProp(object, prop)
		this.#globalCache.set(path, handle)
		return handle
	}

	/**
	 * Resolving promises inside QuickJS is tricky because you have to call
	 * runtime.executePendingJobs() to get the promise to resolve, so you
	 * can't use await syntax even though context.resolvePromise returns a
	 * native Promise. This is a utility method that lets you use await.
	 */
	public resolvePromise = (promise: QuickJSHandle): Promise<QuickJSHandle> => {
		return new Promise((resolve, reject) => {
			this.context.resolvePromise(promise).then((result) => {
				if (isFail(result)) {
					reject(result.error.consume(this.unwrapError))
				} else {
					resolve(result.value)
				}
			}, reject)

			this.runtime.executePendingJobs()
		})
	}

	public call = (fn: string | QuickJSHandle, thisArg: string | QuickJSHandle, args: QuickJSHandle[]): QuickJSHandle => {
		const result = this.context.callFunction(
			typeof fn === "string" ? this.get(fn) : fn,
			typeof thisArg === "string" ? this.get(thisArg) : thisArg,
			...args,
		)

		return this.unwrapResult(result)
	}

	public callAsync = async (
		fn: string | QuickJSHandle,
		thisArg: string | QuickJSHandle,
		args: QuickJSHandle[],
	): Promise<QuickJSHandle> => {
		const resultHandle = this.call(fn, thisArg, args)
		if (this.isInstanceOf(resultHandle, this.get("Promise"))) {
			return resultHandle.consume(this.resolvePromise)
		} else {
			return resultHandle
		}
	}

	public unwrapError = (handle: QuickJSHandle): VMError => {
		return new VMError(this.context.dump(handle))
	}

	public wrapError = (err: any): QuickJSHandle => {
		const error = err instanceof Error ? err : new Error(String(err))

		let constructorName = "Error"
		if (error instanceof SyntaxError) {
			constructorName = "SyntaxError"
		} else if (error instanceof TypeError) {
			constructorName = "TypeError"
		} else if (error instanceof RangeError) {
			constructorName = "RangeError"
		}

		const args = [this.context.newString(error.message)]
		try {
			const errorHandle = this.call(constructorName, this.context.null, args)
			if (error.stack !== undefined) {
				this.context.setProp(errorHandle, "stack", this.context.newString(error.stack))
			}

			return errorHandle
		} finally {
			args.forEach((arg) => arg.dispose())
		}
	}

	public unwrapResult = (result: VmCallResult<QuickJSHandle>): QuickJSHandle => {
		if (isFail(result)) {
			throw result.error.consume(this.unwrapError)
		} else {
			return result.value
		}
	}

	public getBoolean = (handle: QuickJSHandle) => Boolean(this.context.getNumber(handle))

	public getUint8Array = (handle: QuickJSHandle): Uint8Array =>
		Uint8Array.from(this.call("Array.from", "Array", [handle]).consume(this.context.dump))

	public newUint8Array = (value: Uint8Array): QuickJSHandle => {
		const byteArray = Array.from(value).map((byte) => this.context.newNumber(byte))
		return this.wrapArray(byteArray).consume((handle) => this.call("Uint8Array.from", "Uint8Array", [handle]))
	}

	/**
	 * Wrap an array outside a QuickJS VM by one level,
	 * returning a QuickJSHandle in the host environment.
	 * `wrapArray` disposes all of its handle elements.
	 */
	public wrapArray = (array: QuickJSHandle[]): QuickJSHandle => {
		const arrayHandle = this.context.newArray()
		for (const elementHandle of array) {
			this.call("Array.prototype.push", arrayHandle, [elementHandle]).dispose()
			elementHandle.dispose()
		}

		return arrayHandle
	}

	/**
	 * Unwrap an array inside a QuickJS VM by one level,
	 * returning a QuickJSHandle[] in the host environment.
	 * `unwrapArray` does NOT dispose of the original handle.
	 */
	public unwrapArray = <T = QuickJSHandle>(handle: QuickJSHandle, map?: (elementHandle: QuickJSHandle) => T): T[] => {
		const length = this.context.getLength(handle) ?? 0
		const array = new Array<T>(length)
		for (let index = 0; index < length; index++) {
			const elementHandle = this.context
				.newNumber(index)
				.consume((indexHandle) => this.context.getProp(handle, indexHandle))

			if (map === undefined) {
				array[index] = elementHandle as T
			} else {
				array[index] = map(elementHandle)
			}
		}

		return array
	}

	/**
	 * Wrap an object outside a QuickJS VM by one level,
	 * returning a QuickJSHandle in the host environment.
	 * `wrapObject` disposes all of its handle values.
	 */
	public wrapObject = (object: Record<string, QuickJSHandle> | [string, QuickJSHandle][]): QuickJSHandle => {
		const objectHandle = this.context.newObject()
		const entries = Array.isArray(object) ? object : Object.entries(object)
		for (const [key, valueHandle] of entries) {
			valueHandle.consume((handle) => this.context.setProp(objectHandle, key, handle))
		}

		return objectHandle
	}

	/**
	 * Unwrap an object inside a QuickJS VM by one level,
	 * returning a Record<string, QuickJSHandle> in the host environment.
	 * `unwrapObject` does NOT dispose of the original handle.
	 */
	public unwrapObject = <T = QuickJSHandle>(
		handle: QuickJSHandle,
		map?: (propertyHandle: QuickJSHandle) => T,
	): Record<string, T> => {
		const object: Record<string, T> = {}
		const keys = this.call("Object.keys", this.context.null, [handle]).consume(this.unwrapArray)
		for (const keyHandle of keys) {
			const valueHandle = this.context.getProp(handle, keyHandle)
			const key = keyHandle.consume(this.context.getString)
			if (map === undefined) {
				object[key] = valueHandle as T
			} else {
				object[key] = map(valueHandle)
			}
		}

		return object
	}

	public wrapValue = (value: JSValue): QuickJSHandle => {
		if (value === undefined) {
			return this.context.undefined
		} else if (value === null) {
			return this.context.null
		} else if (typeof value === "boolean") {
			return value ? this.context.true : this.context.false
		} else if (typeof value === "number") {
			return this.context.newNumber(value)
		} else if (typeof value === "string") {
			return this.context.newString(value)
		} else if (value instanceof Uint8Array) {
			return this.newUint8Array(value)
		} else if (Array.isArray(value)) {
			return this.wrapArray(value.map(this.wrapValue))
		} else {
			return this.wrapObject(
				Object.entries(value).map<[string, QuickJSHandle]>(([key, value]) => [key, this.wrapValue(value)]),
			)
		}
	}

	public is = (a: QuickJSHandle, b: QuickJSHandle): boolean =>
		this.call("Object.is", this.context.null, [a, b]).consume(this.getBoolean)

	public isArray = (handle: QuickJSHandle): boolean =>
		this.context.typeof(handle) === "object" &&
		this.call("Array.isArray", this.context.null, [handle]).consume(this.context.dump)

	public isInstanceOf = (instanceHandle: QuickJSHandle, classHandle: QuickJSHandle): boolean =>
		this.context.typeof(instanceHandle) === "object" &&
		this.context
			.getProp(instanceHandle, "constructor")
			.consume((constructorHandle) => this.is(constructorHandle, classHandle))

	public isUint8Array = (handle: QuickJSHandle): boolean => this.isInstanceOf(handle, this.get("Uint8Array"))

	public unwrapValue = (handle: QuickJSHandle): JSValue => {
		if (this.is(handle, this.context.undefined)) {
			return undefined
		} else if (this.is(handle, this.context.null)) {
			return null
		}

		switch (this.context.typeof(handle)) {
			case "boolean":
				return this.getBoolean(handle)
			case "number":
				return this.context.getNumber(handle)
			case "string":
				return this.context.getString(handle)
		}

		if (this.isUint8Array(handle)) {
			return this.getUint8Array(handle)
		} else if (this.isArray(handle)) {
			return this.unwrapArray(handle, (elementHandle) => elementHandle.consume(this.unwrapValue))
		} else {
			return this.unwrapObject(handle, (propertyHandle) => propertyHandle.consume(this.unwrapValue))
		}
	}

	public wrapFunction = (fn: (this: QuickJSHandle, ...args: JSValue[]) => Awaitable<void | JSValue>): QuickJSHandle => {
		const wrap = (value: void | JSValue) => (value === undefined ? this.context.undefined : this.wrapValue(value))

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const vm = this

		return this.context.newFunction(fn.name, function (this: QuickJSHandle, ...args) {
			let result: ReturnType<typeof fn> | undefined = undefined
			vm.log("invoking function")
			try {
				result = fn.apply(this, args.map(vm.unwrapValue))
			} catch (err) {
				vm.log("caught error in wrapped function: %O", err)
				return vm.wrapError(err)
			}

			vm.log("got result")
			if (result instanceof Promise) {
				const deferred = vm.context.newPromise()
				result.then(
					(value) => {
						vm.log("resolving deferred promise")
						const handle = wrap(value)
						deferred.settled.then(() => handle.dispose())
						deferred.resolve(handle)
						// wrap(value).consume((handle) => deferred.resolve(handle))
					},
					(err) => {
						vm.log("rejecting deferred promise")
						deferred.reject(vm.wrapError(err))
					},
				)

				deferred.settled.finally(() => vm.runtime.executePendingJobs())

				return deferred.handle
			} else {
				return wrap(result)
			}
		})
	}

	public unwrapFunction = (handle: QuickJSHandle, thisArg?: QuickJSHandle): JSFunction => {
		const copy = handle.dup()
		this.#localCache.add(copy)

		let thisArgCopy = copy
		if (thisArg !== undefined) {
			thisArgCopy = thisArg.dup()
			this.#localCache.add(thisArgCopy)
		}

		return (...args) => {
			const argHandles = args.map(this.wrapValue)
			try {
				const result = this.call(copy, thisArgCopy, argHandles)
				if (this.context.typeof(result) !== "undefined") {
					return result.consume(this.unwrapValue)
				}
			} finally {
				argHandles.forEach((handle) => handle.dispose())
			}
		}
	}

	public unwrapFunctionAsync = (handle: QuickJSHandle, thisArg?: QuickJSHandle): JSFunctionAsync => {
		const copy = this.cache(handle)
		const thisArgCopy = thisArg ? this.cache(thisArg) : copy
		return async (...args) => {
			const argHandles = args.map(this.wrapValue)
			try {
				const result = await this.callAsync(copy, thisArgCopy, argHandles)
				if (this.context.typeof(result) !== "undefined") {
					return result.consume(this.unwrapValue)
				}
			} finally {
				argHandles.forEach((handle) => handle.dispose())
			}
		}
	}

	public cache = (handle: QuickJSHandle): QuickJSHandle => {
		const copy = handle.dup()
		this.#localCache.add(copy)
		return copy
	}

	public isClass = (handle: QuickJSHandle) => {
		if (this.context.typeof(handle) !== "function") {
			return false
		}

		const getOwnPropertyDescriptor = this.get("Object.getOwnPropertyDescriptor")
		using constructorHandle = this.context.getProp(handle, "constructor")
		using prototypeStringHandle = this.context.newString("prototype")
		using propertyDescriptorHandle = this.unwrapResult(
			this.context.callFunction(getOwnPropertyDescriptor, getOwnPropertyDescriptor, [
				constructorHandle,
				prototypeStringHandle,
			]),
		)

		if (this.is(propertyDescriptorHandle, this.context.undefined)) {
			return false
		}

		using writableHandle = this.context.getProp(propertyDescriptorHandle, "writable")
		return this.getBoolean(writableHandle) === false
	}
}
