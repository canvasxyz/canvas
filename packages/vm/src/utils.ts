import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten"

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

const contextCacheMap = new WeakMap<QuickJSContext, Map<string, QuickJSHandle>>()

export function disposeCachedHandles(context: QuickJSContext) {
	const cache = contextCacheMap.get(context)
	if (cache !== undefined) {
		for (const [path, handle] of cache) {
			handle.dispose()
			cache.delete(path)
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
	const cachedHandle = cache.get(path)
	if (cachedHandle !== undefined) {
		return cachedHandle
	} else {
		const elements = path.split(".")
		const prop = elements.pop()
		assert(prop !== undefined)

		const object = elements.length > 0 ? get(context, elements.join(".")) : context.global
		const handle = context.getProp(object, prop)
		cache.set(path, handle)
		return handle
	}
}

function getCache(context: QuickJSContext): Map<string, QuickJSHandle> {
	const cache = contextCacheMap.get(context)
	if (cache !== undefined) {
		return cache
	} else {
		const cache = new Map<string, QuickJSHandle>()
		contextCacheMap.set(context, cache)
		return cache
	}
}
