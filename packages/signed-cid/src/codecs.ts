import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import * as raw from "multiformats/codecs/raw"

import { assert } from "./utils.js"
import { eip712Codec } from "./eip712Codec.js"

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
	eip712Codec,
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
