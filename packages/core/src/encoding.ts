import { createHash } from "node:crypto"

import { ethers } from "ethers"
import * as t from "io-ts"
import * as cbor from "microcbor"

import type { Session, Action, Message } from "@canvas-js/interfaces"

import { actionArgumentType, chainIdType, chainType, uint8ArrayType } from "./codecs.js"
import { signalInvalidType } from "./utils.js"

const { hexlify, arrayify } = ethers.utils

const binaryActionPayloadType = t.type({
	call: t.string,
	args: t.record(t.string, actionArgumentType),
	from: uint8ArrayType,
	spec: t.string,
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
	spec: t.string,
	timestamp: t.number,
	address: uint8ArrayType,
	duration: t.number,
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

export const binaryMessageType = t.union([binaryActionType, binarySessionType])

export type BinaryMessage = t.TypeOf<typeof binaryMessageType>

const toBinarySession = (session: Session): BinarySession => {
	const decode = arrayify

	const response = {
		type: "session",
		signature: arrayify(session.signature),
		payload: {
			...session.payload,
			from: decode(session.payload.from),
			address: decode(session.payload.address),
			blockhash: session.payload.blockhash ? arrayify(session.payload.blockhash) : null,
		},
	} as BinarySession
	return response
}

function fromBinarySession({ signature, payload: { from, address, blockhash, ...payload } }: BinarySession): Session {
	const encode = hexlify

	const session: Session = {
		signature: hexlify(signature).toLowerCase(),
		payload: {
			...payload,
			from: encode(from).toLowerCase(),
			address: encode(address).toLowerCase(),
			blockhash: blockhash ? hexlify(blockhash).toLowerCase() : null,
		},
	}

	return session
}

const toBinaryAction = (action: Action): BinaryAction => {
	const decode = arrayify
	const blockhash = action.payload.blockhash

	return {
		type: "action",
		signature: arrayify(action.signature),
		session: action.session ? decode(action.session) : null,
		payload: {
			...action.payload,
			from: decode(action.payload.from),
			blockhash: blockhash ? arrayify(blockhash) : null,
		},
	}
}

function fromBinaryAction({ signature, session, payload: { from, blockhash, ...payload } }: BinaryAction): Action {
	const encode = hexlify

	const action: Action = {
		signature: hexlify(signature).toLowerCase(),
		session: session && encode(session).toLowerCase(),
		payload: {
			...payload,
			from: encode(from).toLowerCase(),
			blockhash: blockhash ? hexlify(blockhash).toLowerCase() : null,
		},
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
