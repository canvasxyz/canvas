import * as cbor from "@ipld/dag-cbor"
import { CID } from "multiformats/cid"
import { Digest } from "multiformats/hashes/digest"
import { sha256 } from "multiformats/hashes/sha2"

import { Codec } from "./interface.js"
import { assert } from "./utils.js"

export const getDefaultCodec = <T>(): Codec<T> => ({
	keyToString: (key) => CID.decode(key).toString(),
	encode: (event) => {
		const value = cbor.encode(event)
		const digest = sha256.digest(value)
		assert(digest instanceof Digest)
		const cid = CID.createV1(cbor.code, digest)
		return [cid.bytes, value]
	},
	decode: (value) => {
		const digest = sha256.digest(value)
		assert(digest instanceof Digest)
		const cid = CID.createV1(cbor.code, digest)
		const event = cbor.decode(value) as T
		return [cid.bytes, event]
	},
})
