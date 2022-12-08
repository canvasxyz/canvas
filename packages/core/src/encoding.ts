import { createHash } from "node:crypto"

import * as t from "io-ts"
import * as cbor from "microcbor"

import type { Session, Action, Message } from "@canvas-js/interfaces"

import { actionArgumentType, chainIdType, chainType } from "./codecs.js"
import { signalInvalidType } from "./utils.js"

const binaryActionPayloadType = t.type({
	call: t.string,
	args: t.record(t.string, actionArgumentType),
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.null, t.string]),
})

export const binaryActionType = t.type({
	type: t.literal("action"),
	signature: t.string,
	session: t.union([t.null, t.string]),
	payload: binaryActionPayloadType,
})

export type BinaryAction = t.TypeOf<typeof binaryActionType>

const binarySessionPayloadType = t.type({
	from: t.string,
	spec: t.string,
	timestamp: t.number,
	address: t.string,
	duration: t.number,
	chain: chainType,
	chainId: chainIdType,
	blockhash: t.union([t.null, t.string]),
})

export const binarySessionType = t.type({
	type: t.literal("session"),
	signature: t.string,
	payload: binarySessionPayloadType,
})

export type BinarySession = t.TypeOf<typeof binarySessionType>

export const binaryMessageType = t.union([binaryActionType, binarySessionType])

export type BinaryMessage = t.TypeOf<typeof binaryMessageType>

const toBinarySession = (session: Session): BinarySession => {
	return {
		type: "session",
		signature: session.signature,
		payload: {
			...session.payload,
			from: session.payload.from,
			address: session.payload.address,
			blockhash: session.payload.blockhash,
		},
	} as BinarySession
}

function fromBinarySession({ signature, payload: { from, address, blockhash, ...payload } }: BinarySession): Session {
	const session: Session = {
		signature: signature.toLowerCase(),
		payload: {
			...payload,
			from: from.toLowerCase(),
			address: address.toLowerCase(),
			blockhash: blockhash ? blockhash.toLowerCase() : null,
		},
	}

	return session
}

const toBinaryAction = (action: Action): BinaryAction => {
	return {
		type: "action",
		signature: action.signature,
		session: action.session,
		payload: {
			...action.payload,
			from: action.payload.from,
			blockhash: action.payload.blockhash,
		},
	}
}

function fromBinaryAction({ signature, session, payload: { from, blockhash, ...payload } }: BinaryAction): Action {
	const action: Action = {
		signature: signature.toLowerCase(),
		session: session && session.toLowerCase(),
		payload: {
			...payload,
			from: from.toLowerCase(),
			blockhash: blockhash ? blockhash.toLowerCase() : null,
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
