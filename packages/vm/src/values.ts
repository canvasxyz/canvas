// Values

export type JSValue = undefined | null | boolean | number | string | Uint8Array | JSArray | JSObject
export interface JSArray extends Array<JSValue> {}
export interface JSObject {
	[key: string]: JSValue
}

// Functions

export type JSFunction = (...args: JSValue[]) => void | JSValue
export type JSFunctionAsync = (...args: JSValue[]) => Promise<void | JSValue>

// Utilities

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
