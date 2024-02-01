import { sha256 } from "@noble/hashes/sha256"
import { blake3 } from "@noble/hashes/blake3"

import { assert } from "./utils.js"

export type Digest = { name: string; code: number; digest: (iter: Iterable<Uint8Array>) => Uint8Array }

export const digests: Digest[] = [
	{
		name: "sha2-256",
		code: 0x12,
		digest: (iter: Iterable<Uint8Array>) => {
			const hash = sha256.create()
			for (const chunk of iter) {
				hash.update(chunk)
			}

			return hash.digest()
		},
	},
	{
		name: "blake3-256",
		code: 0x1e,
		digest: (iter: Iterable<Uint8Array>) => {
			const hash = blake3.create({ dkLen: 32 })
			for (const chunk of iter) {
				hash.update(chunk)
			}

			return hash.digest()
		},
	},
	{
		name: "blake3-128",
		code: 0x1e,
		digest: (iter: Iterable<Uint8Array>) => {
			const hash = blake3.create({ dkLen: 16 })
			for (const chunk of iter) {
				hash.update(chunk)
			}

			return hash.digest()
		},
	},
	{
		// this corresponds to the "raw" digest in the multicodec spec
		// https://github.com/multiformats/multicodec/blob/696e701b6cb61f54b67a33b002201450d021f312/table.csv#L41
		name: "raw",
		code: 0x55,
		digest: (iter: Iterable<Uint8Array>) => {
			const parts = []
			for (const chunk of iter) {
				for (const char of chunk) {
					parts.push(char)
				}
			}
			return new Uint8Array(parts)
		},
	},
]

export const defaultDigest = "sha2-256"

export function getDigest(options: { digest?: string | Digest }): Digest {
	if (options.digest !== undefined && typeof options.digest !== "string") {
		return options.digest
	}

	const digestName = options.digest ?? defaultDigest
	const digest = digests.find((digest) => digest.name === digestName)
	assert(digest !== undefined, "unsupported digest")
	return digest
}
