import type { Node } from "@canvas-js/okra"

export class MissingParentError extends Error {
	public static name = "MISSING_PARENT"
	public readonly name = MissingParentError.name

	constructor(public readonly parent: string, public readonly id: string) {
		super(`missing parent ${parent} of ${id}`)
	}
}

export class MessageNotFoundError extends Error {
	public static name = "MESSAGE_NOT_FOUND"
	public readonly name = MessageNotFoundError.name

	constructor(public readonly id: string) {
		super(`message ${id} not found`)
	}
}

export class ConflictError extends Error {
	public static name = "CONFLICT"

	public constructor(public readonly source: Node, public readonly target: Node) {
		super(`conflicting values for key`)
	}

	public readonly name = ConflictError.name
}

export class AbortError extends Error {
	public static name = "ABORT"
	public readonly name = AbortError.name

	constructor() {
		super("sync aborted by server")
	}
}
