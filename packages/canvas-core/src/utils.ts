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
export const models = ${JSON.stringify(recursiveClone(obj.models))};
export const routes = ${JSON.stringify(recursiveClone(obj.routes))};
export const actions = {
	${Object.entries(obj.actions).map(([name, action]) => `${JSON.stringify(name)}: ${action.toString()}`)}
}
`
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
