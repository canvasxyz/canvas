export class VMError extends Error {
	constructor(private readonly err: { name: string; message: string; stack: string }) {
		super(`[${err.name}: ${err.message}]`)
	}
}
