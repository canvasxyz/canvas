export type JSValue = undefined | null | boolean | number | string | Uint8Array | JSArray | JSObject
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
	} else if (Array.isArray(value)) {
		return "Array"
	} else {
		return "Object"
	}
}

export const isArray = (value: JSValue): value is JSArray => Array.isArray(value)

export function isObject(value: JSValue): value is JSObject {
	if (typeof value !== "object" || value === null) {
		return false
	} else if (Array.isArray(value) || value instanceof Uint8Array) {
		return false
	} else {
		return true
	}
}
