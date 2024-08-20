import type { Key, Node } from "@canvas-js/okra"

import * as Sync from "#protocols/sync"

export const encodeKey = (key: Key) => key ?? undefined

export function encodeNode({ level, key, hash }: Node): Sync.Node {
	return { level, key: encodeKey(key), hash }
}

export function decodeKey(key: Uint8Array | undefined) {
	if (key === undefined || key.length === 0) {
		return null
	} else {
		return key
	}
}

export function decodeNode({ level, key, hash }: Sync.Node): Node {
	return { level, key: decodeKey(key), hash }
}
