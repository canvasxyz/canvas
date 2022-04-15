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

export const objectSpecToString = (obj: Record<string, any>) => {
	return `
const models = ${JSON.stringify(recursiveClone(obj.models))};
const routes = ${JSON.stringify(recursiveClone(obj.routes))};
const actions = ${JSON.stringify(recursiveClone(obj.actions))};
export { models, routes, actions };`
}
