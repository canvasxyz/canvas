import type { Key, Node } from "@canvas-js/okra"

import * as Sync from "#protocols/sync"

export const encodeKey = (key: Key) => key ?? new Uint8Array([])

export function encodeNode({ level, key, hash, value }: Node): Sync.Node {
	if (value === undefined) {
		return { level, key: encodeKey(key), hash }
	} else {
		return { level, key: encodeKey(key), hash, value }
	}
}

export const decodeKey = (key: Uint8Array) => (key.length === 0 ? null : key)

export function decodeNode({ level, key, hash, value }: Sync.Node): Node {
	if (value === undefined) {
		return { level, key: decodeKey(key), hash }
	} else {
		return { level, key: decodeKey(key), hash, value }
	}
}
