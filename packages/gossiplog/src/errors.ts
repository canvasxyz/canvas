import type { Node } from "@canvas-js/okra"

export class MissingParentError extends Error {
	public static code = "MISSING_PARENT"
	public readonly code = MissingParentError.name

	constructor(public readonly parent: string, public readonly id: string) {
		super(`missing parent ${parent} of ${id}`)
	}
}

export class MessageNotFoundError extends Error {
	public static code = "MESSAGE_NOT_FOUND"
	public readonly code = MessageNotFoundError.name

	constructor(public readonly id: string) {
		super(`message ${id} not found`)
	}
}

export class ConflictError extends Error {
	public static code = "CONFLICT"
	public readonly code = ConflictError.name

	public constructor(public readonly source: Node, public readonly target: Node) {
		super(`conflicting values for key`)
	}
}

export class AbortError extends Error {
	public static code = "ABORT"
	public readonly code = AbortError.name

	constructor() {
		super("sync aborted by server")
	}
}
