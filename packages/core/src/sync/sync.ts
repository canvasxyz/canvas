import assert from "node:assert"

import { sha256 } from "@noble/hashes/sha256"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import { Message } from "@canvas-js/interfaces"

import { messageType } from "@canvas-js/core/codecs"
import type { ReadWriteTransaction, Node } from "@canvas-js/core/components/messageStore"

import { Client } from "./client.js"
import { equalNodes, equalArrays } from "./utils.js"

export async function sync(
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	txn: ReadWriteTransaction,
	handleMessage: (hash: Uint8Array, data: Uint8Array, message: Message) => Promise<void>
): Promise<void> {
	const driver = new Driver(txn, handleMessage, stream)
	try {
		await driver.sync()
	} finally {
		driver.close()
	}
}

class Driver {
	private readonly client: Client
	constructor(
		private readonly txn: ReadWriteTransaction,
		private readonly handleMessage: (hash: Uint8Array, data: Uint8Array, message: Message) => Promise<void>,
		stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>
	) {
		this.client = new Client(stream)
	}

	public close() {
		this.client.end()
	}

	public async sync() {
		const sourceRoot = await this.client.getRoot()
		const targetRoot = await this.txn.getRoot()
		if (sourceRoot.level === 0) {
			return
		} else if (sourceRoot.level === targetRoot.level && equalArrays(sourceRoot.hash, targetRoot.hash)) {
			return
		} else {
			await this.enter(targetRoot.level, sourceRoot)
		}
	}

	private async enter(targetLevel: number, sourceNode: Node) {
		if (sourceNode.level > targetLevel) {
			const children = await this.client.getChildren(sourceNode.level, sourceNode.key)
			for (const sourceChild of children) {
				await this.enter(targetLevel, sourceChild)
			}
		} else {
			await this.scan(sourceNode)
		}
	}

	private async scan(sourceNode: Node) {
		const targetNode = await this.txn.seek(sourceNode.level, sourceNode.key)
		if (targetNode !== null && equalNodes(sourceNode, targetNode)) {
			return
		}

		const children = await this.client.getChildren(sourceNode.level, sourceNode.key)
		if (sourceNode.level > 1) {
			for (const sourceChild of children) {
				await this.scan(sourceChild)
			}
		} else if (sourceNode.level === 1) {
			const ids: Uint8Array[] = []
			for (const { key, id } of children) {
				if (key === null) {
					continue
				}

				assert(id, "expected leaf nodes to have a value")
				const existingRecord = await this.txn.getMessage(id)
				if (existingRecord === null) {
					ids.push(id)
				}
			}

			const decoder = new TextDecoder()

			const messages = await this.client.getMessages(ids)

			for (const [i, data] of messages.entries()) {
				const id = ids[i]
				assert(equalArrays(sha256(data), id), "message response did not match the request hash")
				const message = JSON.parse(decoder.decode(data))
				assert(messageType.is(message), "invalid message")
				await this.handleMessage(id, data, message)
				await this.txn.insertMessage(id, message)
			}
		}
	}
}
