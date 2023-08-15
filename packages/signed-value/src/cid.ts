import { create as createDigest } from "multiformats/hashes/digest"
import { CID } from "multiformats/cid"

import { Codec, getCodec } from "./codecs.js"
import { Digest, getDigest } from "./digests.js"

export function getCID(value: unknown, options: { codec?: string | Codec; digest?: string | Digest } = {}): CID {
	const [codec, digest] = [getCodec(options), getDigest(options)]
	const hash = digest.digest(codec.encode(value))
	return CID.createV1(codec.code, createDigest(digest.code, hash))
}
