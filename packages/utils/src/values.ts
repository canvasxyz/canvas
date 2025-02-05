// Values

export type JSONValue = null | boolean | number | string | JSONArray | JSONObject
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
	[key: string]: JSONValue
}

export type JSValue = undefined | null | boolean | number | string | Uint8Array | JSArray | JSObject
export interface JSArray extends Array<JSValue> {}
export interface JSObject {
	[key: string]: JSValue
}

// Functions

export type JSFunction = (...args: JSValue[]) => undefined | JSValue
export type JSFunctionAsync = (...args: JSValue[]) => Promise<undefined | JSValue>

// Utilities

export function typeOf(value: JSValue) {
	if (value === null) {
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

export function isObject(value: JSValue): value is JSObject {
	return typeOf(value) === "Object"
}

export function merge(from: JSValue, into: JSValue): JSValue {
	if (from === null) {
		return from
	} else if (from === undefined) {
		return into
	} else if (typeof from === "boolean") {
		return from
	} else if (typeof from === "number") {
		return from
	} else if (typeof from === "string") {
		return from
	} else if (from instanceof Uint8Array) {
		return from
	} else if (Array.isArray(from)) {
		return from
	} else {
		// only merge objects
		if (into === undefined) return from
		if (!isObject(from)) return from
		if (!isObject(into)) return from

		const mergedKeys = Array.from(new Set([...Object.keys(from), ...Object.keys(into as {})]))
		const result: Record<string, JSValue> = {}
		for (const key of mergedKeys) {
			if (from[key] === undefined) {
				result[key] = into[key]
			} else if (into[key] === undefined) {
				result[key] = from[key]
			} else {
				const merged = merge(from[key], into[key])
				if (merged === undefined) {
					continue
				}
				result[key] = merged
			}
		}
		return result
	}
}

export function update(from: JSValue, into: JSValue): JSValue {
	if (from === null) {
		return from
	} else if (from === undefined) {
		return into
	} else if (typeof from === "boolean") {
		return from
	} else if (typeof from === "number") {
		return from
	} else if (typeof from === "string") {
		return from
	} else if (from instanceof Uint8Array) {
		return from
	} else if (Array.isArray(from)) {
		return from
	} else {
		// update fields without recursive merging
		if (into === undefined) return from
		if (!isObject(from)) return from
		if (!isObject(into)) return from

		const result: Record<string, JSValue> = { ...into }
		for (const key of Object.keys(from)) {
			if (from[key] === undefined) {
				result[key] = into[key]
			} else if (into[key] === undefined) {
				result[key] = from[key]
			} else {
				result[key] = from[key]
			}
		}
		return result
	}
}
