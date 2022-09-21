import assert from "node:assert"
import { createHash } from "node:crypto"

import { ethers } from "ethers"
import * as t from "io-ts"
import * as cbor from "microcbor"

import type { Block, Session, Action } from "@canvas-js/interfaces"

import { actionArgumentArrayType, chainIdType, chainType, uint8ArrayType } from "./codecs.js"

const { hexlify, arrayify } = ethers.utils

const binaryBlockType = t.type({
	chain: chainType,
	chainId: chainIdType,
	blocknum: t.number,
	blockhash: uint8ArrayType,
	timestamp: t.number,
})

export type BinaryBlock = t.TypeOf<typeof binaryBlockType>

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

/**
 * Guaranteed to encode hex as lower-case
 */
export function encodeAction(action: Action): Uint8Array {
	const binaryAction = toBinaryAction(action)
	return cbor.encode(binaryAction)
}

/**
 * Guaranteed to encode hex as lower-case
 */
export function decodeAction(data: Uint8Array): Action {
	const binaryAction = cbor.decode(data) as BinaryAction
	return fromBinaryAction(binaryAction)
}

/**
 * Guaranteed to encode hex as lower-case
 */
export function encodeSession(session: Session): Uint8Array {
	const binarySession = toBinarySession(session)
	return cbor.encode(binarySession)
}

/**
 * Guaranteed to encode hex as lower-case
 */
export function decodeSession(data: Uint8Array): Session {
	const binarySession = cbor.decode(data) as BinarySession
	return fromBinarySession(binarySession)
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

export async function* source<T>(iter: Iterable<T>) {
	for (const value of iter) yield value
}

// When we send actions over pubsub, we encounter the problem that peers subscribing to
// the topic might not have the session associated with each action already.
// The real way to solve this is with a full-fledged dependecy/mempool system,
// but as a temporary measure we instead just republish all sessions attached to their actions.
// This means the wire format for pubsub messages is different than both `Action` and `BinaryAction`.
// Here, we use CBOR, but a modified BinaryAction where .session is `null | BinarySession`
// instead of `null | string`. We call this type a `BinaryMessage`
type Hash = { hash: Uint8Array }
type BinaryMessage = Omit<BinaryAction, "type" | "session"> &
	Hash & { session: null | (Omit<BinarySession, "type"> & Hash) }

const binaryMessageType: t.Type<BinaryMessage> = t.type({
	hash: uint8ArrayType,
	signature: uint8ArrayType,
	session: t.union([
		t.null,
		t.type({ hash: uint8ArrayType, signature: uint8ArrayType, payload: binarySessionPayloadType }),
	]),
	payload: binaryActionPayloadType,
})

export function encodeBinaryMessage(
	{ hash: actionHash, action }: { hash: string; action: Action },
	{ hash: sessionHash, session }: { hash: string | null; session: Session | null }
): Uint8Array {
	assert(
		action.session?.toLowerCase() === session?.payload.address.toLowerCase(),
		"encodeBinaryMessage: action.session does not match session"
	)

	const message: BinaryMessage = {
		hash: arrayify(actionHash),
		signature: arrayify(action.signature),
		session: null,
		payload: {
			...action.payload,
			from: arrayify(action.payload.from),
			block: action.payload.block ? toBinaryBlock(action.payload.block) : null,
		},
	}

	if (sessionHash !== null && session !== null) {
		const { type, ...binarySession } = toBinarySession(session)
		message.session = { hash: arrayify(sessionHash), ...binarySession }
	}

	return cbor.encode(message)
}

export function decodeBinaryMessage(data: Uint8Array): { action: Action; session: Session | null } {
	const binaryMessage = cbor.decode(data)
	if (!binaryMessageType.is(binaryMessage)) {
		throw new Error("decodeBinaryMessage: invalid binary message")
	}

	const { from, block, ...payload } = binaryMessage.payload

	// We do a little extra work here to validate the hashes *inside* of decodeBinaryMessage
	// to avoid re-constructing BinarySession and BinaryAction objects afterwards.
	const binaryAction: BinaryAction = {
		type: "action",
		signature: binaryMessage.signature,
		session: binaryMessage.session && binaryMessage.session.payload.address,
		payload: binaryMessage.payload,
	}

	const binaryActionDigest = createHash("sha256").update(cbor.encode(binaryAction)).digest()
	assert(binaryActionDigest.compare(binaryMessage.hash) === 0, "decodeBinaryMessage: action hash does not match")

	const action: Action = {
		session: null,
		signature: hexlify(binaryMessage.signature).toLowerCase(),
		payload: { ...payload, from: hexlify(from).toLowerCase() },
	}

	if (block !== null) {
		action.payload.block = fromBinaryBlock(block)
	}

	if (binaryMessage.session !== null) {
		const { signature, payload } = binaryMessage.session
		const binarySession: BinarySession = { type: "session", signature, payload }
		const binarySessionDigest = createHash("sha256").update(cbor.encode(binarySession)).digest()
		assert(
			binarySessionDigest.compare(binaryMessage.session.hash) === 0,
			"decodeBinaryMessage: session hash does not match"
		)

		const session = fromBinarySession(binarySession)
		action.session = session.payload.address
		return { action, session }
	} else {
		return { action, session: null }
	}
}
