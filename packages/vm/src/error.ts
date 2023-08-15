import assert from "assert"

export class VMError extends Error {
	public readonly name: string
	constructor(error: any) {
		assert(typeof error === "object")
		assert(typeof error.name === "string")
		assert(typeof error.message === "string")
		super(error.message)
		this.name = error.name
		if (error.stack !== undefined) {
			this.stack = error.stack
		}
	}
}
