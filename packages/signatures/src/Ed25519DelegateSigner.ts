import { ed25519 } from "@noble/curves/ed25519"
import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"

import type { Message, Signature, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { decodeURI, encodeURI } from "./utils.js"

/**
 * Ed25519DelegateSigner ONLY supports the following codecs:
 * - dag-cbor
 * - dag-json
 */
export class Ed25519DelegateSigner<Payload = unknown> implements Signer<Payload> {
	public static type = "ed25519" as const
	public static cborCodec = "dag-cbor" as const
	public static jsonCodec = "dag-json" as const

	public readonly uri: string
	public readonly codecs = [Ed25519DelegateSigner.cborCodec, Ed25519DelegateSigner.jsonCodec]

	readonly #privateKey: Uint8Array

	public static verify<Payload = unknown>(signature: Signature, message: Message<Payload>) {
		const { type, publicKey } = decodeURI(signature.publicKey)
		assert(type === Ed25519DelegateSigner.type)
		if (signature.codec === Ed25519DelegateSigner.cborCodec) {
			const bytes = cbor.encode(message)
			assert(ed25519.verify(signature.signature, bytes, publicKey), "invalid ed25519 dag-cbor signature")
		} else if (signature.codec === Ed25519DelegateSigner.jsonCodec) {
			const bytes = json.encode(message)
			assert(ed25519.verify(signature.signature, bytes, publicKey), "invalid ed25519 dag-json signature")
		} else {
			throw new Error(`Ed25519Delegate only supports dag-cbor and dag-json codecs`)
		}
	}

	/**
	 * @param privateKey 32-byte ed25519 private key
	 */
	public constructor(init?: { type: string; privateKey: Uint8Array }) {
		if (init === undefined) {
			this.#privateKey = ed25519.utils.randomPrivateKey()
		} else {
			assert(init.type === Ed25519DelegateSigner.type)
			assert(init.privateKey.length === 32)
			this.#privateKey = init.privateKey
		}

		const publicKey = ed25519.getPublicKey(this.#privateKey)
		this.uri = encodeURI(Ed25519DelegateSigner.type, publicKey)
	}

	public sign(message: Message<Payload>, options: { codec?: string } = {}): Signature {
		const codec = options.codec ?? Ed25519DelegateSigner.cborCodec
		if (codec === Ed25519DelegateSigner.cborCodec) {
			const bytes = cbor.encode(message)
			const signature = ed25519.sign(bytes, this.#privateKey)
			return { codec, publicKey: this.uri, signature }
		} else if (codec === Ed25519DelegateSigner.jsonCodec) {
			const bytes = json.encode(message)
			const signature = ed25519.sign(bytes, this.#privateKey)
			return { codec, publicKey: this.uri, signature }
		} else {
			throw new Error(`Ed25519Delegate only supports dag-cbor and dag-json codecs`)
		}
	}

	public verify(signature: Signature, message: Message<Payload>) {
		Ed25519DelegateSigner.verify(signature, message)
	}

	public export(): { type: string; privateKey: Uint8Array } {
		return { type: Ed25519DelegateSigner.type, privateKey: this.#privateKey }
	}
}
