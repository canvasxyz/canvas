import { createHash } from "node:crypto"
import assert from "node:assert"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import * as okra from "@canvas-js/okra-node"

import { Message } from "@canvas-js/interfaces"

import RPC from "../../rpc/sync/index.cjs"

import { actionType, sessionType } from "../codecs.js"
import { signalInvalidType } from "../utils.js"

import { Client } from "./client.js"
import { type MessageStore, getMessageType, equalNodes, getMessageKey } from "./utils.js"

const { CANVAS_SESSION, CANVAS_ACTION } = RPC.MessageRequest.MessageType

export async function sync(
	messageStore: MessageStore,
	txn: okra.Transaction,
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	handleMessage: (hash: Buffer, data: Uint8Array, message: Message) => Promise<void>
): Promise<void> {
	const driver = new Driver(messageStore, txn, handleMessage, stream)
	try {
		await driver.sync()
	} finally {
		driver.close()
	}
}

class Driver {
	private readonly client: Client
	constructor(
		private readonly messageStore: MessageStore,
		private readonly txn: okra.Transaction,
		private readonly handleMessage: (hash: Buffer, data: Uint8Array, message: Message) => Promise<void>,
		stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>
	) {
		this.client = new Client(stream)
	}

	public close() {
		this.client.end()
	}

	public async sync() {
		const { level: sourceLevel, hash: sourceHash } = await this.client.getRoot()
		const { level: targetLevel, hash: targetHash } = this.txn.getRoot()

		if (sourceLevel === targetLevel && sourceHash.equals(targetHash)) {
			return
		} else {
			await this.enter(targetLevel, { level: sourceLevel, key: null, hash: sourceHash })
		}
	}

	private async enter(targetLevel: number, sourceNode: okra.Node) {
		if (sourceNode.level > targetLevel) {
			const children = await this.client.getChildren(sourceNode.level, sourceNode.key)
			for (const sourceChild of children) {
				await this.enter(targetLevel, sourceChild)
			}
		} else {
			await this.scan(sourceNode)
		}
	}

	private async scan(sourceNode: okra.Node) {
		const targetNode = this.txn.seek(sourceNode.level, sourceNode.key)
		// assert(targetNode !== null, "expected targetNode to not be null")
		if (targetNode !== null && equalNodes(sourceNode, targetNode)) {
			return
		}

		const children = await this.client.getChildren(sourceNode.level, sourceNode.key)
		if (sourceNode.level > 1) {
			for (const sourceChild of children) {
				await this.scan(sourceChild)
			}
		} else {
			const requests: { type: RPC.MessageRequest.MessageType; id: Buffer }[] = []
			for (const { key, value } of children) {
				if (key === null) {
					continue
				}

				assert(value !== undefined, "expected leaf nodes to have a Buffer .value")
				const type = getMessageType(key)
				if (type === CANVAS_SESSION) {
					if (this.messageStore.getSessionByHash(value) === null) {
						requests.push({ type, id: value })
					}
				} else if (type === CANVAS_ACTION) {
					if (this.messageStore.getActionByHash(value) === null) {
						requests.push({ type, id: value })
					}
				} else {
					signalInvalidType(type)
				}
			}

			const decoder = new TextDecoder()

			const messages = await this.client.getMessages(requests)

			for (const [i, data] of messages.entries()) {
				const { id, type } = requests[i]
				assert(createHash("sha256").update(data).digest().equals(id), "message response did not match the request hash")

				const message = JSON.parse(decoder.decode(data))
				if (type === CANVAS_SESSION) {
					assert(sessionType.is(message), "invalid session")
				} else if (type === CANVAS_ACTION) {
					assert(actionType.is(message), "invalid action")
				} else {
					signalInvalidType(type)
				}

				await this.handleMessage(id, data, message)
				this.txn.set(getMessageKey(id, message), id)
			}
		}
	}
}
