import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"

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
