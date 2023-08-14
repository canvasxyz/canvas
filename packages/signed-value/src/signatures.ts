import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"
import { CID } from "multiformats/cid"
import { create as createDigest } from "multiformats/hashes/digest"

import { Codec, codecs, getCodec } from "./codecs.js"
import { Digest, digests, getDigest } from "./digests.js"
import { assert, signalInvalidType } from "./utils.js"

export type Signed<T> = {
	type: "ed25519" | "secp256k1"
	publicKey: Uint8Array
	signature: Uint8Array
	cid: CID
	value: T
}

export function verifySignedValue<T>(
	{ type, publicKey, signature, cid, value }: Signed<T>,
	options: { codecs?: Codec[]; digests?: Digest[] } = {}
) {
	const codec = (options.codecs ?? codecs).find((codec) => codec.code === cid.code)
	assert(codec !== undefined, "unsupported codec")

	const digest = (options.digests ?? digests).find((digest) => digest.code === cid.multihash.code)
	assert(digest !== undefined, "unsupported digest")

	assert(getCID(codec, digest, value).equals(cid), "signed CID does not match value")

	if (type === "ed25519") {
		assert(ed25519.verify(signature, cid.bytes, publicKey), "invalid ed25519 signature")
	} else if (type === "secp256k1") {
		assert(
			secp256k1.verify(secp256k1.Signature.fromCompact(signature), cid.bytes, publicKey),
			"invalid secp256k1 signature"
		)
	} else {
		signalInvalidType(type)
	}
}

export function createSignedValue<T>(
	type: "ed25519" | "secp256k1",
	privateKey: Uint8Array,
	value: T,
	options: { codec?: string | Codec; digest?: string | Digest } = {}
): Signed<T> {
	const [codec, digest] = [getCodec(options), getDigest(options)]
	const cid = getCID(codec, digest, value)

	if (type === "ed25519") {
		const publicKey = ed25519.getPublicKey(privateKey)
		const signature = ed25519.sign(cid.bytes, privateKey)
		return { type, publicKey, signature, cid, value }
	} else if (type === "secp256k1") {
		const publicKey = secp256k1.getPublicKey(privateKey, true)
		const signature = secp256k1.sign(cid.bytes, privateKey).toCompactRawBytes()
		return { type, publicKey, signature, cid, value }
	} else {
		signalInvalidType(type)
	}
}

function getCID(codec: Codec, digest: Digest, value: unknown): CID {
	const hash = digest.digest(codec.encode(value))
	return CID.createV1(codec.code, createDigest(digest.code, hash))
}
