import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import * as raw from "multiformats/codecs/raw"
import { getBytes } from "ethers"
import { TypedDataEncoder } from "ethers/hash"

import { assert } from "./utils.js"

export type Codec = { name: string; code: number; encode: (value: any) => Iterable<Uint8Array> }

export const codecs: Codec[] = [
	{
		name: "dag-cbor",
		code: cbor.code,

		// TODO: use a streaming encoder with a no-copy mode
		encode: (value) => [cbor.encode(value)],
	},
	{
		name: "dag-json",
		code: json.code,

		// TODO: use a streaming encoder with a no-copy mode
		encode: (value) => [json.encode(value)],
	},
	{
		name: "raw",
		code: raw.code,
		encode: (value) => {
			if (typeof value === "string") {
				const encoder = new TextEncoder()
				return [encoder.encode(value)]
			} else if (value instanceof Uint8Array) {
				return [value]
			} else {
				throw new TypeError("raw values must be strings or Uint8Arrays")
			}
		},
	},
	{
		name: "eip712",
		code: 712,
		encode: (rawValue) => {
			try {
				const { domain, types, value } = rawValue
				return [getBytes(TypedDataEncoder.hash(domain, types, value))]
			} catch (e) {
				throw new TypeError("the value must be an EIP-712 serializable object")
			}
		},
	},
]

export const defaultCodec = "dag-cbor"

export function getCodec(options: { codec?: string | Codec }): Codec {
	if (options.codec !== undefined && typeof options.codec !== "string") {
		return options.codec
	}

	const codecName = options.codec ?? defaultCodec
	const codec = codecs.find((codec) => codec.name === codecName)
	assert(codec !== undefined, "unsupported codec")
	return codec
}
