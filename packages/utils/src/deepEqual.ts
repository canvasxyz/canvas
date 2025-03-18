import { JSValue, isArray, isObject } from "./JSValue.js"
import { zip } from "./zip.js"

export function deepEqual(a: JSValue, b: JSValue): boolean {
	// undefined, null, boolean, number, string
	if (a === b) {
		return true
	}

	// Uint8Array
	if (a instanceof Uint8Array && b instanceof Uint8Array) {
		if (a.byteLength !== b.byteLength) {
			return false
		}

		for (let i = 0; i < a.byteLength; i++) {
			if (a[i] !== b[i]) {
				return false
			}
		}

		return true
	}

	// Array
	if (isArray(a) && isArray(b)) {
		if (a.length !== b.length) {
			return false
		}

		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false
			}
		}

		return true
	}

	// Object
	if (isObject(a) && isObject(b)) {
		const aKeys = Object.keys(a).sort()
		const bKeys = Object.keys(b).sort()

		if (aKeys.length !== bKeys.length) {
			return false
		}

		for (const [aKey, bKey] of zip(aKeys, bKeys)) {
			if (aKey !== bKey || !deepEqual(a[aKey], b[bKey])) {
				return false
			}
		}

		return true
	}

	return false
}
