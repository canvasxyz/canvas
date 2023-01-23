import { createHash } from "node:crypto"

import { ethers } from "ethers"
import * as t from "io-ts"
import * as cbor from "microcbor"

import type { Session, Action, Message } from "@canvas-js/interfaces"

import { actionArgumentType, chainIdType, chainType, uint8ArrayType } from "./codecs.js"
import { decodeAddress, decodeBlockhash, encodeAddress, encodeBlockhash } from "./chains/index.js"
import { signalInvalidType } from "./utils.js"

const { hexlify, arrayify } = ethers.utils

const binaryActionPayloadType = t.type({
	call: t.string,
	callArgs: t.record(t.string, actionArgumentType),
	from: uint8ArrayType,
	app: t.string,
	timestamp: t.number,
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.null, uint8ArrayType]),
})

export const binaryActionType = t.type({
	type: t.literal("action"),
	signature: uint8ArrayType,
	session: t.union([t.null, uint8ArrayType]),
	payload: binaryActionPayloadType,
})

export type BinaryAction = t.TypeOf<typeof binaryActionType>

const binarySessionPayloadType = t.type({
	from: uint8ArrayType,
	app: t.string,
	sessionAddress: uint8ArrayType,
	sessionDuration: t.number,
	sessionIssued: t.number,
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.null, uint8ArrayType]),
})

export const binarySessionType = t.type({
	type: t.literal("session"),
	signature: uint8ArrayType,
	payload: binarySessionPayloadType,
})

export type BinarySession = t.TypeOf<typeof binarySessionType>

export const binaryMessageType: t.Type<BinaryAction | BinarySession> = t.union([binaryActionType, binarySessionType])

export type BinaryMessage = t.TypeOf<typeof binaryMessageType>

export function toBinarySession(session: Session): BinarySession {
	const { chain, chainId, from, sessionAddress, blockhash } = session.payload

	return {
		type: "session",
		signature: arrayify(session.signature),
		payload: {
			...session.payload,
			from: encodeAddress(chain, chainId, from),
			sessionAddress: encodeAddress(chain, chainId, sessionAddress),
			blockhash: blockhash ? encodeBlockhash(chain, chainId, blockhash) : null,
		},
	}
}

export function fromBinarySession(session: BinarySession): Session {
	const { chain, chainId, from, sessionAddress, blockhash } = session.payload

	return {
		type: "session",
		signature: hexlify(session.signature),
		payload: {
			...session.payload,
			from: decodeAddress(chain, chainId, from),
			sessionAddress: decodeAddress(chain, chainId, sessionAddress),
			blockhash: blockhash ? decodeBlockhash(chain, chainId, blockhash) : null,
		},
	}
}

export function toBinaryAction(action: Action): BinaryAction {
	const { chain, chainId, from, blockhash } = action.payload

	return {
		type: "action",
		signature: arrayify(action.signature),
		session: action.session ? encodeAddress(chain, chainId, action.session) : null,
		payload: {
			...action.payload,
			from: encodeAddress(chain, chainId, from),
			blockhash: blockhash ? encodeBlockhash(chain, chainId, blockhash) : null,
		},
	}
}

export function fromBinaryAction(action: BinaryAction): Action {
	const { chain, chainId, from, blockhash } = action.payload

	return {
		type: "action",
		signature: hexlify(action.signature),
		session: action.session && decodeAddress(chain, chainId, action.session),
		payload: {
			...action.payload,
			from: decodeAddress(chain, chainId, from),
			blockhash: blockhash ? decodeBlockhash(chain, chainId, blockhash) : null,
		},
	}
}

export function fromBinaryMessage(binaryMessage: BinaryMessage): Message {
	if (binaryMessage.type === "action") {
		return fromBinaryAction(binaryMessage)
	} else if (binaryMessage.type === "session") {
		return fromBinarySession(binaryMessage)
	} else {
		signalInvalidType(binaryMessage)
	}
}

export const encodeBinaryMessage = (message: BinaryMessage) => cbor.encode(message)

export function decodeBinaryMessage(data: Uint8Array): BinaryMessage {
	const binaryMessage = cbor.decode(data)
	if (!binaryMessageType.is(binaryMessage)) {
		throw new Error("invalid message")
	}

	return binaryMessage
}

export function normalizeAction(action: Action): [hash: Buffer, action: BinaryAction, data: Uint8Array] {
	const binaryAction = toBinaryAction(action)
	const data = cbor.encode(binaryAction)
	const hash = createHash("sha256").update(data).digest()
	return [hash, binaryAction, data]
}

export function normalizeSession(session: Session): [hash: Buffer, session: BinarySession, data: Uint8Array] {
	const binarySession = toBinarySession(session)
	const data = cbor.encode(binarySession)
	const hash = createHash("sha256").update(data).digest()
	return [hash, binarySession, data]
}

export function normalizeMessage(message: Message): [hash: Buffer, binaryMessage: BinaryMessage, data: Uint8Array] {
	if (message.type === "action") {
		return normalizeAction(message)
	} else if (message.type === "session") {
		return normalizeSession(message)
	} else {
		signalInvalidType(message)
	}
}
