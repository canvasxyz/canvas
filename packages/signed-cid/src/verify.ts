import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"
import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import type { Signature } from "@canvas-js/interfaces"

import { Ed25519Signer } from "./Ed25519Signer.js"
import { Secp256k1Signer } from "./Secp256k1Signer.js"

import { Codec, codecs } from "./codecs.js"
import { Digest, digests } from "./digests.js"
import { getCID } from "./cid.js"
import { assert } from "./utils.js"

export const didKeyPattern = /^did:key:(z[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)$/

export type SignatureType = (typeof Ed25519Signer)["type"] | (typeof Secp256k1Signer)["type"]

/**
 * Verify that the signature is valid, and that signature.cid matches the given value
 */
export function verifySignedValue(
	signature: Signature,
	value: any,
	options: { types?: SignatureType[]; codecs?: Codec[]; digests?: Digest[] } = {},
) {
	const codec = (options.codecs ?? codecs).find((codec) => codec.code === signature.cid.code)
	assert(codec !== undefined, "unsupported codec")

	const digest = (options.digests ?? digests).find((digest) => digest.code === signature.cid.multihash.code)
	assert(digest !== undefined, "unsupported digest")
	assert(getCID(value, { codec, digest }).equals(signature.cid), "signed CID does not match value")

	verifySignature(signature, { types: options.types })
}

/**
 * Verify that the signature is valid for the given CID
 */
export function verifySignature(
	{ publicKey: uri, signature, cid }: Signature,
	options: { types?: SignatureType[] } = {},
) {
	const types = options.types ?? ["ed25519", "secp256k1"]
	const result = didKeyPattern.exec(uri)
	assert(result !== null, "invalid public key URI")
	const bytes = base58btc.decode(result[1])
	const [keyCodec, keyCodecLength] = varint.decode(bytes)
	const publicKey = bytes.subarray(keyCodecLength)
	if (keyCodec === Ed25519Signer.code && types.includes(Ed25519Signer.type)) {
		assert(ed25519.verify(signature, cid.bytes, publicKey), "invalid ed25519 signature")
	} else if (keyCodec === Secp256k1Signer.code && types.includes(Secp256k1Signer.type)) {
		assert(
			secp256k1.verify(secp256k1.Signature.fromCompact(signature), cid.bytes, publicKey, { prehash: true }),
			"invalid secp256k1 signature",
		)
	} else {
		throw new Error("unsupported key codec")
	}
}
