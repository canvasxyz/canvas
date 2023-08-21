import * as cbor from "@ipld/dag-cbor"
import { CID } from "multiformats/cid"
import { Digest } from "multiformats/hashes/digest"
import { sha256 } from "multiformats/hashes/sha2"
import { bytesToHex } from "@noble/hashes/utils"
import { concat } from "uint8arrays"

import { Encoding } from "./AbstractStore.js"
import { IPLDValue } from "./types.js"
import { assert } from "./utils.js"

export interface OrderedEncodingOptions<T extends IPLDValue = IPLDValue> {
	prefixByteLength: number
	getPrefix: (event: T) => Uint8Array
}

export const createOrderedEncoding = <T extends IPLDValue>(options: OrderedEncodingOptions<T>): Encoding<T> => ({
	keyToString: (key) => {
		const cid = CID.decode(key.subarray(options.prefixByteLength))
		if (options.prefixByteLength === 0) {
			return cid.toString()
		} else {
			const prefix = key.subarray(0, options.prefixByteLength)
			return `0x${bytesToHex(prefix)}:${cid.toString()}`
		}
	},
	encode: (event) => {
		const value = cbor.encode(event)
		const digest = sha256.digest(value)
		assert(digest instanceof Digest)
		const cid = CID.createV1(cbor.code, digest)
		if (options.prefixByteLength === 0) {
			return [cid.bytes, value]
		} else {
			const prefix = options.getPrefix(event)
			assert(prefix.byteLength === options.prefixByteLength, "prefix is not prefixByteLength bytes")
			return [concat([prefix, cid.bytes]), value]
		}
	},
	decode: (value) => {
		const digest = sha256.digest(value)
		assert(digest instanceof Digest)
		const cid = CID.createV1(cbor.code, digest)
		const event = cbor.decode(value) as T
		if (options.prefixByteLength === 0) {
			return [cid.bytes, event]
		} else {
			const prefix = options.getPrefix(event)
			assert(prefix.byteLength === options.prefixByteLength, "prefix is not prefixByteLength bytes")
			return [concat([prefix, cid.bytes]), event]
		}
	},
})

export const createDefaultEncoding = <T extends IPLDValue>() =>
	createOrderedEncoding<T>({ prefixByteLength: 0, getPrefix: () => new Uint8Array([]) })
