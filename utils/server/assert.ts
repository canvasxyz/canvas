import assert from "assert"

export function match(
	value: string,
	pattern: RegExp,
	errorMsg?: string
): RegExpExecArray {
	const match = pattern.exec(value)
	assert(match !== null, errorMsg)
	return match
}
