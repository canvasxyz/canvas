import { CBORValue } from "microcbor"
import { QuickJSHandle } from "quickjs-emscripten"

export function assert(condition: unknown, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? "assertion failed")
	}
}

export const mapEntries = <K extends string, S, T>(object: Record<K, S>, map: (key: K, value: S) => T) =>
	Object.fromEntries(Object.entries<S>(object).map(([key, value]) => [key, map(key as K, value)])) as Record<K, T>

export function signalInvalidType(type: never): never {
	console.error(type)
	throw new TypeError("internal error: invalid type")
}

export function typeOf(value: CBORValue) {
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
	} else if (Array.isArray(value)) {
		return "Array"
	} else {
		return "Object"
	}
}

const ids = new WeakMap<QuickJSHandle, number>()
let nextId = 0

export function getId(handle: QuickJSHandle): number {
	const existingId = ids.get(handle)
	if (existingId !== undefined) {
		return existingId
	} else {
		const id = nextId++
		ids.set(handle, id)
		return id
	}
}
