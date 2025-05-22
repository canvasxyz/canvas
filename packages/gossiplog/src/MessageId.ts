// IDs are made by concatenating a **reverse** unsigned varint clock with the hash and then
// truncating to 20 bytes to be base32-friendly, e.g "05vj050kb09l7okead3vvi6so7c7tunn"

import { sha256 } from "@noble/hashes/sha256"
import { base32hex } from "multiformats/bases/base32"
import { encodeClock, decodeClock } from "./clock.js"

export const KEY_LENGTH = 20
export const ID_LENGTH = 32
export const MIN_MESSAGE_ID = "00000000000000000000000000000000"
export const MAX_MESSAGE_ID = "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"
export const messageIdPattern = /^[0123456789abcdefghijklmnopqrstuv]{32}$/

export const encodeId = (id: string) => base32hex.baseDecode(id)
export const decodeId = (key: Uint8Array) => base32hex.baseEncode(key)

export class MessageId {
	public static decode(key: Uint8Array): MessageId {
		const id = decodeId(key)
		const [clock] = decodeClock(key)
		return new MessageId(id, key, clock)
	}

	public static encode(id: string): MessageId {
		const key = encodeId(id)
		const [clock] = decodeClock(key)
		return new MessageId(id, key, clock)
	}

	public constructor(
		public readonly id: string,
		public readonly key: Uint8Array,
		public readonly clock: number,
	) {}

	public equals(other: MessageId) {
		return this.id === other.id
	}

	public toString(): string {
		return this.id
	}
}
