import { CarReader } from "@ipld/car"
import { CID } from "multiformats/cid"
import * as raw from "multiformats/codecs/raw"
import * as cbor from "@ipld/dag-cbor"

import { getModuleArchive } from "#std/import"
import { assert } from "../utils.js"

export function importModules(): Promise<Map<string, string>> {
	return extractModuleArchive(getModuleArchive({}))
}

async function extractModuleArchive(iter: AsyncIterable<Uint8Array>): Promise<Map<string, string>> {
	const decoder = new TextDecoder()
	const modules = new Map<string, string>()

	const reader = await CarReader.fromIterable(iter)
	const [rootCID] = await reader.getRoots()
	assert(rootCID !== undefined, "archive missing root CID")
	assert(rootCID.code === cbor.code, "invalid root CID (expected raw)")
	const root = await reader.get(rootCID)
	assert(root !== undefined, "root block not found in archive")

	const index = cbor.decode<Record<string, CID>>(root.bytes)
	for (const [path, cid] of Object.entries(index)) {
		assert(cid.code === raw.code, "invalid module CID codec (expected raw)")
		const block = await reader.get(cid)
		assert(block !== undefined, "module block not found in archive")
		modules.set(path, decoder.decode(block.bytes))
	}

	return modules
}
