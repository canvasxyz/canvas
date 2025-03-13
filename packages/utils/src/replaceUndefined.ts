import { JSValue, JSArray, JSObject, isArray, isObject } from "./JSValue.js"

/** Recursively replace every `undefined` with `null` in ararys and objects */
export function replaceUndefined(value: JSValue, inPlace = false): JSValue {
	if (isArray(value)) {
		return replaceUndefinedArray(value, inPlace)
	} else if (isObject(value)) {
		return replaceUndefinedObject(value, inPlace)
	} else {
		return value ?? null
	}
}

function replaceUndefinedArray(value: JSArray, inPlace: boolean): JSArray {
	if (!inPlace) return value.map((v) => replaceUndefined(v, inPlace))

	for (const [i, v] of value.entries()) {
		if (v === undefined) {
			value[i] = null
		} else if (isArray(v)) {
			replaceUndefinedArray(v, inPlace)
		} else if (isObject(v)) {
			replaceUndefinedObject(v, inPlace)
		}
	}

	return value
}

function replaceUndefinedObject(value: JSObject, inPlace: boolean): JSObject {
	if (!inPlace) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceUndefined(v, inPlace)]))

	for (const [k, v] of Object.entries(value)) {
		if (v === undefined) {
			value[k] = null
		} else if (isArray(v)) {
			replaceUndefinedArray(v, inPlace)
		} else if (isObject(v)) {
			replaceUndefinedObject(v, inPlace)
		}
	}

	return value
}
