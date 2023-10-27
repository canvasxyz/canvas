import { ed25519 } from "@noble/curves/ed25519"

import type { Message, MessageSigner } from "@canvas-js/interfaces"
import { createSignature } from "@canvas-js/signed-cid"

export class Ed25519Signer<T = unknown> implements MessageSigner<T> {
	public readonly publicKey: Uint8Array
	readonly #privateKey: Uint8Array

	public constructor(privateKey = ed25519.utils.randomPrivateKey()) {
		this.#privateKey = privateKey
		this.publicKey = ed25519.getPublicKey(this.#privateKey)
	}

	public sign(message: Message<T>) {
		return createSignature("ed25519", this.#privateKey, message)
	}
}
