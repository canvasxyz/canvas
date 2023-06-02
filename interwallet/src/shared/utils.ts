export function assert(condition: unknown, message?: string): asserts condition {
	if (condition) {
		return
	} else {
		throw new Error(message ?? "assertion error")
	}
}
