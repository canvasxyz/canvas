import { secp256k1 } from "@noble/curves/secp256k1"
import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import type { Signature, Signer } from "@canvas-js/interfaces"

import { Codec } from "./codecs.js"
import { Digest } from "./digests.js"
import { getCID } from "./cid.js"

export class Secp256k1Signer<T = any> implements Signer<T> {
	public static type = "secp256k1" as const
	public static code = 0xe7

	public readonly uri: string
	readonly #privateKey: Uint8Array

	/**
	 * @param privateKey 33-byte secp256k1 private key
	 */
	public constructor(privateKey = secp256k1.utils.randomPrivateKey()) {
		const encodingLength = varint.encodingLength(Secp256k1Signer.code)
		const publicKey = secp256k1.getPublicKey(privateKey)
		const bytes = new Uint8Array(encodingLength + publicKey.byteLength)
		varint.encodeTo(Secp256k1Signer.code, bytes, 0)
		bytes.set(publicKey, encodingLength)

		this.uri = `did:key:${base58btc.encode(bytes)}`
		this.#privateKey = privateKey
	}

	public sign(value: T, options: { codec?: string | Codec; digest?: string | Digest } = {}): Signature {
		const cid = getCID(value, options)
		const signature = secp256k1.sign(cid.bytes, this.#privateKey).toCompactRawBytes()
		return { publicKey: this.uri, signature, cid }
	}

	public export(): { type: "secp256k1"; privateKey: Uint8Array } {
		return { type: "secp256k1", privateKey: this.#privateKey }
	}
}
