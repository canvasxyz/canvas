import { createHash } from "node:crypto"
import assert from "node:assert"

import chalk from "chalk"
import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import * as okra from "node-okra"

import { BinaryMessage, decodeBinaryMessage } from "../encoding.js"
import { Client } from "./client.js"

export async function sync(
	mst: okra.Tree,
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	handleMessage: (hash: Buffer, data: Uint8Array, message: BinaryMessage) => Promise<void>
): Promise<void> {
	const target = new okra.Target(mst)
	const client = new Client(stream)

	async function enter(targetLevel: number, sourceLevel: number, sourceRoot: Buffer, sourceHash: Buffer) {
		if (sourceLevel > targetLevel) {
			const children = await client.getChildren(sourceLevel, sourceRoot)
			for (const { leaf, hash } of children) {
				await enter(targetLevel, sourceLevel - 1, leaf, hash)
			}
		} else {
			await scan(sourceLevel, sourceRoot, sourceHash)
		}
	}

	async function scan(level: number, sourceRoot: Buffer, sourceHash: Buffer) {
		const { leaf: targetRoot, hash: targetHash } = target.seek(level, sourceRoot)
		if (targetRoot.equals(sourceRoot) && targetHash.equals(sourceHash)) {
			return
		}

		const children = await client.getChildren(level, sourceRoot)
		if (level > 1) {
			for (const { leaf, hash } of children) {
				await scan(level - 1, leaf, hash)
			}
		} else {
			const leaves = target.filter(children)
			const values = await client.getValues(leaves)
			assert(values.length === leaves.length, "expected values.length to match leaves.length")

			for (const [i, data] of values.entries()) {
				const { hash } = leaves[i]
				assert(createHash("sha256").update(data).digest().equals(hash), "received bad value for hash")
				const message = decodeBinaryMessage(data)
				await handleMessage(hash, data, message)
			}
		}
	}

	try {
		const { level: sourceLevel, hash: sourceValue } = await client.getRoot()
		const sourceRoot = Buffer.alloc(14)
		await enter(target.getRootLevel(), sourceLevel, sourceRoot, sourceValue)
	} catch (err) {
		console.log(chalk.red(`[canvas-core] Error performing outgoing sync:`), err)
	} finally {
		client.end()
		target.close()
	}
}
