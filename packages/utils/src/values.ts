import { JSValue, isObject, isArray } from "./JSValue.js"

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
	} else if (isArray(from)) {
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
