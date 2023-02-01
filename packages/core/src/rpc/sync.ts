import { createHash } from "node:crypto"
import assert from "node:assert"

import chalk from "chalk"
import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import * as okra from "node-okra"

import { Message } from "@canvas-js/interfaces"

import RPC from "../../rpc/sync/index.cjs"

import { actionType, sessionType } from "../codecs.js"
import { signalInvalidType } from "../utils.js"

import { Client } from "./client.js"
import { type MessageStore, getMessageType, equalNodes, getMessageKey } from "./utils.js"

const { CANVAS_SESSION, CANVAS_ACTION } = RPC.MessageRequest.MessageType

export async function sync(
	messageStore: MessageStore,
	mst: okra.Tree,
	stream: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	handleMessage: (hash: Buffer, data: Uint8Array, message: Message) => Promise<void>
): Promise<void> {
	const txn = new okra.Transaction(mst, { readOnly: false })
	const cursor = new okra.Cursor(txn)
	const client = new Client(stream)

	async function enter(targetLevel: number, sourceNode: okra.Node) {
		if (sourceNode.level > targetLevel) {
			const children = await client.getChildren(sourceNode.level, sourceNode.key)
			for (const sourceChild of children) {
				await enter(targetLevel, sourceChild)
			}
		} else {
			await scan(sourceNode)
		}
	}

	async function scan(sourceNode: okra.Node) {
		const targetNode = cursor.seek(sourceNode.level, sourceNode.key)
		assert(targetNode !== null, "expected targetNode to not be null")
		if (equalNodes(sourceNode, targetNode)) {
			return
		}

		const children = await client.getChildren(sourceNode.level, sourceNode.key)
		if (sourceNode.level > 1) {
			for (const sourceChild of children) {
				await scan(sourceChild)
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
					if (messageStore.getSessionByHash(value) === null) {
						requests.push({ type, id: value })
					}
				} else if (type === CANVAS_ACTION) {
					if (messageStore.getActionByHash(value) === null) {
						requests.push({ type, id: value })
					}
				} else {
					signalInvalidType(type)
				}
			}

			const decoder = new TextDecoder()

			const messages = await client.getMessages(requests)

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

				await handleMessage(id, data, message)
				txn.set(getMessageKey(id, message), id)
			}
		}
	}

	try {
		const { level: sourceLevel, hash: sourceHash } = await client.getRoot()
		const { level: targetLevel } = txn.getRoot()
		await enter(targetLevel, { level: sourceLevel, key: null, hash: sourceHash })
		cursor.close()
		txn.commit()
	} catch (err) {
		cursor.close()
		txn.abort()

		if (err instanceof Error) {
			console.log(chalk.red(`[canvas-core] Error performing outgoing sync (${err.message})`))
		} else {
			throw err
		}
	} finally {
		client.end()
	}
}
