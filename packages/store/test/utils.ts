import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import { Key, Node } from "@canvas-js/okra-node"
import { bytesToHex } from "@noble/hashes/utils"

export function getDirectory(t: ExecutionContext<unknown>): string {
	const directory = path.resolve(os.tmpdir(), nanoid())
	console.log("CREATING", directory)
	fs.mkdirSync(directory)
	t.teardown(() => {
		console.log("REMOVING", directory)
		fs.rmSync(directory, { recursive: true })
	})

	return directory
}

export const printKey = (key: Key) => (key === null ? "null" : bytesToHex(key))
export const printNode = (node: Node) => `{ ${node.level} | ${printKey(node.key)} | ${bytesToHex(node.hash)} }`
