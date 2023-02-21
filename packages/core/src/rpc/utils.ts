import type { Node } from "@canvas-js/okra-node"

import type { Action, Message, Session } from "@canvas-js/interfaces"

import RPC from "../../rpc/sync/index.cjs"

import { fromHex, signalInvalidType, toBuffer } from "../utils.js"

// We declare this interface to enforce that handleIncomingStream only has read access to the message store.
export interface MessageStore {
	getSessionByHash(hash: Buffer): Session | null
	getActionByHash(hash: Buffer): Action | null
}

const { CANVAS_SESSION, CANVAS_ACTION } = RPC.MessageRequest.MessageType

export const getMessageType = (key: Buffer) => (key.readUintBE(0, 6) % 2 === 0 ? CANVAS_SESSION : CANVAS_ACTION)

export const getMessageKey = (hash: Buffer | string, message: Message) => {
	const key = Buffer.alloc(14)
	if (message.type === "action") {
		key.writeUintBE(message.payload.timestamp * 2 + 1, 0, 6)
	} else if (message.type === "session") {
		key.writeUintBE(message.payload.sessionIssued * 2, 0, 6)
	} else if (message.type === "customAction") {
		// custom actions don't have a timestamp
		key.writeUintBE(0, 0, 6)
	} else {
		signalInvalidType(message)
	}

	if (typeof hash === "string") {
		fromHex(hash).copy(key, 6, 0, 8)
	} else {
		hash.copy(key, 6, 0, 8)
	}

	return key
}

export const toKey = (array: Uint8Array) => (array.length === 0 ? null : toBuffer(array))

export const toNode = ({ level, key, hash, value }: RPC.Node): Node => {
	if (value) {
		return { level, key: toKey(key), hash: toBuffer(hash), value: toBuffer(value) }
	} else {
		return { level, key: toKey(key), hash: toBuffer(hash) }
	}
}

export const equalKeys = (a: Buffer | null, b: Buffer | null) =>
	(a === null && b === null) || (a !== null && b !== null && a.equals(b))

export const equalNodes = (a: Node, b: Node) => a.level === b.level && equalKeys(a.key, b.key) && a.hash.equals(b.hash)
