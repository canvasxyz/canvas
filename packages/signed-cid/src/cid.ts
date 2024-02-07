import { create as createDigest } from "multiformats/hashes/digest"
import { CID } from "multiformats/cid"

import { Codec, getCodec } from "./codecs.js"
import { Digest, getDigest } from "./digests.js"
import { encode as eip712Encode } from "./eip712.js"

export function getCID(value: any, options: { codec?: string | Codec; digest?: string | Digest } = {}): CID {
	const [codec, digest] = [getCodec(options), getDigest(options)]
	const hash = digest.digest(codec.encode(codec.code === 0x55 && digest.code === 0x55 ? eip712Encode(value) : value))
	return CID.createV1(codec.code, createDigest(digest.code, hash))
}
