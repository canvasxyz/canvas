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
		} else {
			clone[i] = JSON.stringify(obj[i])
		}
	}
	return clone
}

export const objectToString = (obj: Record<string, any>) => {
	return JSON.stringify(recursiveClone(obj))
}
