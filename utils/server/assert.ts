export function assert(condition: any, errorMsg: string) {
	if (!condition) {
		throw new Error(errorMsg)
	}
}

export function match(
	value: string,
	pattern: RegExp,
	errorMsg: string
): RegExpExecArray {
	const match = pattern.exec(value)
	if (match === null) {
		throw new Error(errorMsg)
	}

	return match
}
