import { ed25519 } from "@noble/curves/ed25519"
import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import type { Signature, Signer } from "@canvas-js/interfaces"

import { Codec } from "./codecs.js"
import { Digest } from "./digests.js"
import { getCID } from "./cid.js"

export class Ed25519Signer<T = any> implements Signer<T> {
	public static type = "ed25519" as const
	public static code = 0xed

	public readonly uri: string
	readonly #privateKey: Uint8Array

	/**
	 * @param privateKey 32-byte ed25519 private key
	 */
	public constructor(privateKey = ed25519.utils.randomPrivateKey()) {
		const encodingLength = varint.encodingLength(Ed25519Signer.code)
		const publicKey = ed25519.getPublicKey(privateKey)
		const bytes = new Uint8Array(encodingLength + publicKey.byteLength)
		varint.encodeTo(Ed25519Signer.code, bytes, 0)
		bytes.set(publicKey, encodingLength)

		this.uri = `did:key:${base58btc.encode(bytes)}`
		this.#privateKey = privateKey
	}

	public sign(value: T, options: { codec?: string | Codec; digest?: string | Digest } = {}): Signature {
		const cid = getCID(value, options)
		const signature = ed25519.sign(cid.bytes, this.#privateKey)
		return { publicKey: this.uri, signature, cid }
	}

	public export(): { type: "ed25519"; privateKey: Uint8Array } {
		return { type: "ed25519", privateKey: this.#privateKey }
	}
}
