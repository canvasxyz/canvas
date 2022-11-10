import { createHash } from "node:crypto"

import { ethers } from "ethers"
import * as t from "io-ts"
import * as cbor from "microcbor"

import type { Block, Session, Action, Message } from "@canvas-js/interfaces"

import { actionArgumentArrayType, chainIdType, chainType, uint8ArrayType } from "./codecs.js"
import { signalInvalidType } from "./utils.js"

const { hexlify, arrayify } = ethers.utils

const binaryBlockType = t.type({
	chain: chainType,
	chainId: chainIdType,
	blocknum: t.number,
	blockhash: uint8ArrayType,
	timestamp: t.number,
})

type BinaryBlock = t.TypeOf<typeof binaryBlockType>

const binaryActionPayloadType = t.type({
	call: t.string,
	args: actionArgumentArrayType,
	from: uint8ArrayType,
	spec: t.string,
	timestamp: t.number,
	block: t.union([t.null, binaryBlockType]),
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
	spec: t.string,
	timestamp: t.number,
	address: uint8ArrayType,
	duration: t.number,
	block: t.union([t.null, binaryBlockType]),
})

export const binarySessionType = t.type({
	type: t.literal("session"),
	signature: uint8ArrayType,
	payload: binarySessionPayloadType,
})

export type BinarySession = t.TypeOf<typeof binarySessionType>

export const binaryMessageType = t.union([binaryActionType, binarySessionType])

export type BinaryMessage = t.TypeOf<typeof binaryMessageType>

const toBinaryBlock = ({ blockhash, ...block }: Block): BinaryBlock => ({ ...block, blockhash: arrayify(blockhash) })

const fromBinaryBlock = ({ blockhash, ...binaryBlock }: BinaryBlock): Block => ({
	...binaryBlock,
	blockhash: hexlify(blockhash).toLowerCase(),
})

const toBinarySession = (session: Session): BinarySession => ({
	type: "session",
	signature: arrayify(session.signature),
	payload: {
		...session.payload,
		from: arrayify(session.payload.from),
		address: arrayify(session.payload.address),
		block: session.payload.block ? toBinaryBlock(session.payload.block) : null,
	},
})

function fromBinarySession({ signature, payload: { from, address, block, ...payload } }: BinarySession): Session {
	const session: Session = {
		signature: hexlify(signature).toLowerCase(),
		payload: {
			...payload,
			from: hexlify(from).toLowerCase(),
			address: hexlify(address).toLowerCase(),
		},
	}

	if (block !== null) {
		session.payload.block = fromBinaryBlock(block)
	}

	return session
}

const toBinaryAction = (action: Action): BinaryAction => ({
	type: "action",
	signature: arrayify(action.signature),
	session: action.session ? arrayify(action.session) : null,
	payload: {
		...action.payload,
		from: arrayify(action.payload.from),
		block: action.payload.block ? toBinaryBlock(action.payload.block) : null,
	},
})

function fromBinaryAction({ signature, session, payload: { from, block, ...payload } }: BinaryAction): Action {
	const action: Action = {
		signature: hexlify(signature).toLowerCase(),
		session: session && hexlify(session).toLowerCase(),
		payload: { ...payload, from: hexlify(from).toLowerCase() },
	}

	if (block !== null) {
		action.payload.block = fromBinaryBlock(block)
	}

	return action
}

export const encodeAction = (action: Action) => cbor.encode(toBinaryAction(action))

export const encodeSession = (session: Session) => cbor.encode(toBinarySession(session))

export function encodeMessage(message: Message): Uint8Array {
	if (message.type === "action") {
		return encodeAction(message)
	} else if (message.type === "session") {
		return encodeSession(message)
	} else {
		signalInvalidType(message)
	}
}

export function decodeMessage(data: Uint8Array): Message {
	const binaryMessage = cbor.decode(data)
	if (!binaryMessageType.is(binaryMessage)) {
		throw new Error("invalid message")
	}

	if (binaryMessage.type === "action") {
		// @ts-expect-error
		return { type: "action", ...fromBinaryAction(binaryMessage) }
	} else if (binaryMessage.type === "session") {
		// @ts-expect-error
		return { type: "session", ...fromBinarySession(binaryMessage) }
	} else {
		signalInvalidType(binaryMessage.type)
	}
}

/**
 * Guaranteed to encode hex as lower-case
 */
export function getActionHash(action: Action): string {
	const data = cbor.encode(toBinaryAction(action))
	return "0x" + createHash("sha256").update(data).digest("hex")
}

/**
 * Guaranteed to encode hex as lower-case
 */
export function getSessionHash(session: Session): string {
	const data = cbor.encode(toBinarySession(session))
	return "0x" + createHash("sha256").update(data).digest("hex")
}
