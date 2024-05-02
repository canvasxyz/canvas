import { ed25519 } from "@noble/curves/ed25519"
import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"

import type { Message, Signature, SignatureScheme, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { decodeURI, encodeURI } from "./utils.js"

const codecs = { cbor: "dag-cbor", json: "dag-json" }

/**
 * Ed25519Signer only supports the following codecs:
 * - dag-cbor
 * - dag-json
 */
class Ed25519Signer<Payload = unknown> implements Signer<Payload> {
	public readonly publicKey: string
	public readonly scheme: SignatureScheme<any> = Ed25519SignatureScheme

	readonly #privateKey: Uint8Array

	/**
	 * @param privateKey 32-byte ed25519 private key
	 */
	public constructor(init?: { type: string; privateKey: Uint8Array }) {
		if (init === undefined) {
			this.#privateKey = ed25519.utils.randomPrivateKey()
		} else {
			assert(init.type === Ed25519SignatureScheme.type)
			assert(init.privateKey.length === 32)
			this.#privateKey = init.privateKey
		}

		const publicKey = ed25519.getPublicKey(this.#privateKey)
		this.publicKey = encodeURI(Ed25519SignatureScheme.type, publicKey)
	}

	public sign(message: Message<Payload>, options: { codec?: string } = {}): Signature {
		const codec = options.codec ?? codecs.cbor
		if (codec === codecs.cbor) {
			const bytes = cbor.encode(message)
			const signature = ed25519.sign(bytes, this.#privateKey)
			return { codec, publicKey: this.publicKey, signature }
		} else if (codec === codecs.json) {
			const bytes = json.encode(message)
			const signature = ed25519.sign(bytes, this.#privateKey)
			return { codec, publicKey: this.publicKey, signature }
		} else {
			throw new Error("Ed25519Delegate only supports 'dag-cbor' and 'dag-json' codecs")
		}
	}

	public export(): { type: string; privateKey: Uint8Array } {
		return { type: Ed25519SignatureScheme.type, privateKey: this.#privateKey }
	}
}

export const Ed25519SignatureScheme = {
	type: "ed25519",
	codecs: [codecs.cbor, codecs.json],

	verify: (signature: Signature, message: Message<any>) => {
		const { type, publicKey } = decodeURI(signature.publicKey)
		assert(type === Ed25519SignatureScheme.type)
		if (signature.codec === codecs.cbor) {
			const bytes = cbor.encode(message)
			assert(ed25519.verify(signature.signature, bytes, publicKey), "invalid ed25519 dag-cbor signature")
		} else if (signature.codec === codecs.json) {
			const bytes = json.encode(message)
			assert(ed25519.verify(signature.signature, bytes, publicKey), "invalid ed25519 dag-json signature")
		} else {
			throw new Error("ed25519 only supports 'dag-cbor' and 'dag-json' codecs")
		}
	},

	create: <Payload>(init?: { type: string; privateKey: Uint8Array }) => new Ed25519Signer<Payload>(init),
} satisfies SignatureScheme<any>
