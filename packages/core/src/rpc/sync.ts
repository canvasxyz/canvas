import { createHash } from "node:crypto"

import chalk from "chalk"
import type { Stream } from "@libp2p/interface-connection"

import * as okra from "node-okra"

import { toHex } from "../utils.js"
import { BinaryMessage, decodeBinaryMessage } from "../encoding.js"
import { Client } from "./client.js"

export async function sync(
	mst: okra.Tree,
	stream: Stream,
	applyBatch: (messages: [string, BinaryMessage][]) => Promise<void>
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

		const chidlren = await client.getChildren(level, sourceRoot)
		if (level > 1) {
			for (const { leaf, hash } of chidlren) {
				await scan(level - 1, leaf, hash)
			}
		} else {
			const leaves = target.filter(chidlren)
			const values = await client.getValues(leaves)
			if (values.length !== leaves.length) {
				throw new Error("expected values.length to match leaves.length")
			}

			const messages: [string, BinaryMessage][] = []

			for (const [i, value] of values.entries()) {
				const { hash } = leaves[i]
				if (!createHash("sha256").update(value).digest().equals(hash)) {
					throw new Error(`the value received for ${toHex(hash)} did not match the hash`)
				}

				messages.push([toHex(hash), decodeBinaryMessage(value)])
			}

			await applyBatch(messages)
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
