import type { SessionSigner } from "./SessionSigner.js"

export class SignerCache {
	signers: SessionSigner[]
	private default: string | undefined // this is exposed just for debugging

	constructor(signers: SessionSigner[] = []) {
		this.signers = signers
		if (signers[0]) {
			this.default = signers[0].key
		}
	}

	updateSigners(signers: SessionSigner[]) {
		this.signers = signers
		if (signers[0]) {
			this.default = signers[0].key
		}
	}

	getAll() {
		return this.signers
	}

	getFirst() {
		return this.signers[0]
	}
}
