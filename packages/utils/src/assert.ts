export class AssertError extends Error {
	constructor(public readonly message: string, public readonly props?: any) {
		super(message)
	}
}

export function assert(condition: unknown, message = "assertion failed", props?: any): asserts condition {
	if (!condition) {
		throw new AssertError(message, props)
	}
}
