import { CID } from "multiformats"
import { CarReader } from "@ipld/car"
import * as cbor from "@ipld/dag-cbor"

import { assert } from "./utils.js"
import { Commit } from "./commit.js"

type Node = { l: CID; e: Entry[] }
type Entry = { p: number; k: Uint8Array; v?: CID; t?: CID }

async function unpackNode<T>(car: CarReader, path: string, cid: CID, decoder = new TextDecoder()): Promise<T> {
	const block = await car.get(cid)
	const { l, e } = cbor.decode<Node>(block.bytes)

	let node = l
	let needle = ""
	for (const { p, k, v, t } of e) {
		needle = needle.slice(0, p) + decoder.decode(k)
		if (needle < path) {
			assert(t !== undefined, "failed to parse record")
			node = t
		} else if (needle === path) {
			assert(v !== undefined, "failed to parse record")
			const block = await car.get(v)
			return cbor.decode<T>(block.bytes)
		} else {
			break
		}
	}

	return await unpackNode(car, path, node, decoder)
}

export async function unpackArchive<T extends { $type: string }>(
	archive: Uint8Array,
	path: string
): Promise<{ commit: Commit; record: T }> {
	const car = await CarReader.fromBytes(archive)
	const [root] = await car.getRoots()
	const block = await car.get(root)
	const commit = cbor.decode<Commit>(block.bytes)

	const record = await unpackNode<T>(car, path, commit.data)
	const [collection] = path.split("/")
	assert(record.$type === collection, "invalid record type")
	return { commit, record }
}
