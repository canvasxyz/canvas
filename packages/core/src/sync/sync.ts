import { sha256 } from "@noble/hashes/sha256"

import type { CID } from "multiformats"
import type { Duplex, Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"
import { equals } from "uint8arrays/equals"

import { Message } from "@canvas-js/interfaces"

import { messageType } from "@canvas-js/core/codecs"
import { assert, toHex } from "@canvas-js/core/utils"
import type { Node, ReadWriteTransaction } from "@canvas-js/core/components/messageStore"

import { Client } from "./client.js"
import { equalNodes } from "./utils.js"
import chalk from "chalk"

type Context = { cid: CID; txn: ReadWriteTransaction; client: Client }

export async function* sync(
	cid: CID,
	txn: ReadWriteTransaction,
	stream: Duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>,
	options: { verbose?: boolean } = {}
): AsyncGenerator<[hash: Uint8Array, message: Message]> {
	const client = new Client(stream)
	try {
		const sourceRoot = await client.getRoot()
		const targetRoot = await txn.getRoot()

		if (sourceRoot.level === 0) {
			return
		} else if (sourceRoot.level === targetRoot.level && equals(sourceRoot.hash, targetRoot.hash)) {
			return
		} else {
			if (options.verbose) {
				console.log(chalk.gray(`[canvas-core] [${cid}] [sync] The old merkle root is ${toHex(targetRoot.hash)}`))
			}

			yield* enter({ cid, txn, client }, targetRoot.level, sourceRoot)

			if (options.verbose) {
				const { hash: newRoot } = await txn.getRoot()
				console.log(chalk.gray(`[canvas-core] [${cid}] [sync] The new merkle root is ${toHex(newRoot)}`))
			}
		}
	} finally {
		client.end()
	}
}

async function* enter(
	{ cid, txn, client }: Context,
	targetLevel: number,
	sourceNode: Node
): AsyncGenerator<[hash: Uint8Array, message: Message]> {
	if (sourceNode.level > targetLevel) {
		const children = await client.getChildren(sourceNode.level, sourceNode.key)
		if (targetLevel === 0 && sourceNode.level === 1) {
			const ids: Uint8Array[] = []

			for (const { level, key, id } of children) {
				if (key === null) {
					continue
				}

				assert(level === 0, "unexpected child level")
				assert(id !== undefined, "expected leaf nodes to have a value")
				ids.push(id)
			}

			yield* getMessages({ cid, txn, client }, ids)
		} else {
			for (const sourceChild of children) {
				yield* enter({ cid, txn, client }, targetLevel, sourceChild)
			}
		}
	} else {
		yield* scan({ cid, txn, client }, sourceNode)
	}
}

async function* scan(
	{ cid, txn, client }: Context,
	sourceNode: Node
): AsyncGenerator<[hash: Uint8Array, message: Message]> {
	const targetNode = await txn.seek(sourceNode.level, sourceNode.key)
	if (targetNode !== null && equalNodes(sourceNode, targetNode)) {
		return
	}

	const children = await client.getChildren(sourceNode.level, sourceNode.key)
	if (sourceNode.level > 1) {
		for (const sourceChild of children) {
			yield* scan({ cid, txn, client }, sourceChild)
		}
	} else if (sourceNode.level === 1) {
		const ids: Uint8Array[] = []
		for (const { level, key, id } of children) {
			if (key === null) {
				continue
			}

			assert(level === 0, "unexpected child level")
			assert(id !== undefined, "expected leaf nodes to have a value")
			const existingRecord = await txn.getMessage(id)
			if (existingRecord === null) {
				ids.push(id)
			}
		}

		yield* getMessages({ cid, txn, client }, ids)
	}
}

async function* getMessages(
	{ txn, client }: Context,
	ids: Uint8Array[]
): AsyncGenerator<[hash: Uint8Array, message: Message]> {
	const decoder = new TextDecoder()

	const messages = await client.getMessages(ids)

	for (const [i, data] of messages.entries()) {
		const hash = ids[i]
		assert(equals(sha256(data), hash), "message response did not match the request hash")

		const message = JSON.parse(decoder.decode(data))
		assert(messageType.is(message), "invalid message")

		// if application fails, we don't insert, but do continue syncing the rest of the messages.
		try {
			yield [hash, message]
		} catch (err) {
			continue
		}

		await txn.insertMessage(hash, message)
	}
}
