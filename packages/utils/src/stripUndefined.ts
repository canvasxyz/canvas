import { JSValue, JSArray, JSObject, isArray, isObject } from "./JSValue.js"

/** Recursively remove every object entry with value `undefined` */
export function stripUndefined(value: JSValue, inPlace = false): JSValue {
	if (isArray(value)) {
		return stripUndefinedArray(value, inPlace)
	} else if (isObject(value)) {
		return stripUndefinedObject(value, inPlace)
	} else {
		return value
	}
}

function stripUndefinedArray(value: JSArray, inPlace: boolean): JSArray {
	if (!inPlace) return value.map((v) => stripUndefined(v, false))

	for (const v of value) {
		if (isArray(v)) {
			stripUndefinedArray(v, inPlace)
		} else if (isObject(v)) {
			stripUndefinedObject(v, inPlace)
		}
	}

	return value
}

function stripUndefinedObject(value: JSObject, inPlace: boolean): JSObject {
	if (!inPlace)
		return Object.fromEntries(
			Object.entries(value)
				.filter(([k, v]) => v !== undefined)
				.map(([k, v]) => [k, stripUndefined(v, false)]),
		)

	for (const [k, v] of Object.entries(value)) {
		if (v === undefined) {
			delete value[k]
		} else if (isArray(v)) {
			stripUndefinedArray(v, inPlace)
		} else if (isObject(v)) {
			stripUndefinedObject(v, inPlace)
		}
	}

	return value
}
