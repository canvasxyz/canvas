import type { Key, Node } from "@canvas-js/okra"

import * as Sync from "#protocols/sync"

export const encodeKey = (key: Key) => key ?? new Uint8Array([])

export function encodeNode({ level, key, hash }: Node): Sync.Node {
	return { level, key: encodeKey(key), hash }
}

export const decodeKey = (key: Uint8Array) => (key.length === 0 ? null : key)

export function decodeNode({ level, key, hash }: Sync.Node): Node {
	return { level, key: decodeKey(key), hash }
}
