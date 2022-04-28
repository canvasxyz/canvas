import type { ObjectSpec } from "./specs"

/**
 * Recursively clones objects, using Function.prototype.toString() to stringify
 * functions, and JSON.stringify to stringify everything else.
 */
const recursiveClone = (obj: Record<string, any>) => {
	const clone: Record<string, any> = {}
	for (const i in obj) {
		if (obj[i] !== null && typeof obj[i] === "object") {
			clone[i] = recursiveClone(obj[i])
		} else if (typeof obj[i] === "function") {
			clone[i] = obj[i].toString()
		} else if (typeof obj[i] === "number") {
			clone[i] = obj[i]
		} else if (typeof obj[i] === "string") {
			clone[i] = obj[i]
		} else if (typeof obj[i] === "boolean") {
			clone[i] = obj[i]
		} else {
			clone[i] = JSON.stringify(obj[i])
		}
	}
	return clone
}

export function objectSpecToString(obj: ObjectSpec): string {
	return `
export const models = ${JSON.stringify(recursiveClone(obj.models), null, "  ")};
export const routes = ${JSON.stringify(recursiveClone(obj.routes), null, "  ")};
export const actions = {
  ${Object.entries(obj.actions)
		.map(([name, action]) => specFunctionToString(name, action))
		.join(",\n  ")}
}
`
}

const functionPrefix = "function "

function specFunctionToString(name: string, f: (...args: any[]) => void) {
	let source = f.toString()
	if (source.startsWith(functionPrefix)) {
		source = source.slice(functionPrefix.length)
	}
	if (source.startsWith(name)) {
		source = source.slice(name.length)
	}
	return JSON.stringify(name) + source
}

export function assert(value: boolean, message?: string): asserts value {
	if (!value) {
		if (message === undefined) {
			throw new Error("assertion failed")
		} else {
			throw new Error(message)
		}
	}
}
