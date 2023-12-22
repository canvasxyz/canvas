import type { SessionSigner } from "./SessionSigner.js"

export class SignerCache {
	#signers: SessionSigner[]

	constructor(signers: SessionSigner[] = []) {
		this.#signers = signers
	}

	updateSigners(signers: SessionSigner[]) {
		this.#signers = signers
	}

	getAll() {
		return this.#signers
	}

	getFirst() {
		return this.#signers[0]
	}
}
