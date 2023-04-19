import { equals } from "uint8arrays/equals"

import type { Message } from "@canvas-js/interfaces"
import type { Node } from "@canvas-js/core/components/messageStore"
import RPC from "@canvas-js/core/rpc/sync"

const timestampBuffer = new ArrayBuffer(8)
const timestampBufferView = new DataView(timestampBuffer)

const getMessageIndex = (message: Message) => {
	if (message.type === "session") {
		return message.payload.sessionIssued * 2
	} else if (message.type === "action") {
		return message.payload.timestamp * 2 + 1
	} else {
		return 0
	}
}

export const getMessageKey = (hash: Uint8Array, message: Message) => {
	const key = new Uint8Array(14)
	const index = getMessageIndex(message)
	timestampBufferView.setBigUint64(0, BigInt(index), false)
	key.set(new Uint8Array(timestampBuffer, 2, 6), 0)
	key.set(hash.subarray(0, 8), 6)
	return key
}

export const equalKeys = (a: Uint8Array | null, b: Uint8Array | null) =>
	(a === null && b === null) || (a !== null && b !== null && equals(a, b))

export const equalNodes = (a: Node, b: Node) => a.level === b.level && equalKeys(a.key, b.key) && equals(a.hash, b.hash)

export const toKey = (array: Uint8Array) => (array.length === 0 ? null : array)

export function toNode({ level, key, hash, value }: RPC.Node): Node {
	if (value instanceof Uint8Array) {
		return { level, key: toKey(key), hash, id: value }
	} else {
		return { level, key: toKey(key), hash }
	}
}

export const fromKey = (key: Uint8Array | null) => key ?? new Uint8Array([])

export function fromNode({ level, key, hash, id }: Node): RPC.Node {
	if (id instanceof Uint8Array) {
		return RPC.Node.create({ level, key: fromKey(key), hash, value: id })
	} else {
		return RPC.Node.create({ level, key: fromKey(key), hash })
	}
}
