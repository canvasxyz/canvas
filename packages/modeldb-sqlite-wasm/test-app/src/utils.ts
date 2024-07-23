export function assert(condition: boolean, message = "Assertion failed") {
	if (!condition) {
		throw new Error(message)
	}
}

export function assertDeepEqual(o1: any, o2: any) {
	assert(deepEqual(o1, o2), `${o1} is not deep equal to ${o2}`)
}

export function assertIs(o1: any, o2: any) {
	assert(o1 === o2, `${o1} is not equal to ${o2}`)
}

export async function assertThrown(func: () => Promise<void>, message: string) {
	let exceptionThrown = false

	try {
		await func()
	} catch (e: any) {
		exceptionThrown = true
		if (e.message !== message) {
			throw new Error(`Expected error message to be "${message}", but got "${e.message}"`)
		}
	}

	if (!exceptionThrown) {
		throw new Error("Expected an exception to be thrown, but none was thrown")
	}
}

function deepEqual(o1: any, o2: any) {
	const o1Type = typeof o1
	const o2Type = typeof o2
	if (o1Type !== o2Type) {
		return false
	} else if (o1Type === "function") {
		throw new Error("Cannot compare functions")
		// } else if (o1 instanceof Array) {
		// 	// compare all elements of o1 and o2
		// 	if (o1.length !== o2.length) {
		// 		return false
		// 	} else {
		// 		for (let i = 0; i < o1.length; i++) {
		// 			if (!deepEqual(o1[i], o2[i])) {
		// 				return false
		// 			}
		// 		}
		// 	}
	} else if (
		o1Type === "undefined" ||
		o1Type === "bigint" ||
		o1Type === "boolean" ||
		o1Type === "number" ||
		o1Type === "string" ||
		o1Type === "symbol" ||
		o1 === null ||
		o2 === null
	) {
		return o1 === o2
	} else if (o1Type === "object") {
		const keys1 = Object.keys(o1)
		const keys2 = Object.keys(o2)
		if (keys1.length !== keys2.length) {
			return false
		}
		for (const key of keys1) {
			if (!deepEqual(o1[key], o2[key])) {
				return false
			}
		}
		return true
	} else {
		throw new Error(`Unknown type: ${o1Type}`)
	}
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}
	return values
}
