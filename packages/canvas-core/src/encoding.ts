import assert from "node:assert"
import { createHash } from "node:crypto"

import type { Chain, ChainId, ActionArgument, Block, Session, Action } from "@canvas-js/interfaces"
import { ethers } from "ethers"
import * as cbor from "microcbor"
import * as t from "io-ts"

import { actionArgumentArrayType, chainIdType, chainType } from "./codecs.js"

const { hexlify, arrayify } = ethers.utils

export type BinaryBlock = {
	chain: Chain
	chainId: ChainId
	blocknum: number
	blockhash: Uint8Array
	timestamp: number
}

export type BinaryAction = {
	type: "action"
	signature: Uint8Array
	session: Uint8Array | null
	payload: {
		call: string
		args: ActionArgument[]
		from: Uint8Array
		spec: string
		timestamp: number
		block: BinaryBlock | null
	}
}

export type BinarySession = {
	type: "session"
	signature: Uint8Array
	payload: {
		from: Uint8Array
		spec: string
		timestamp: number
		address: Uint8Array
		duration: number
		block: BinaryBlock | null
	}
}

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
export async function getActionHash(action: Action): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([toBinaryAction(action)]))) {
		hash.update(chunk)
	}

	return "0x" + hash.digest("hex")
}

/**
 * Guaranteed to encode hex as lower-case
 */
export async function getSessionHash(session: Session): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([toBinarySession(session)]))) {
		hash.update(chunk)
	}

	return "0x" + hash.digest("hex")
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

const isUint8Array = (u: unknown): u is Uint8Array => u instanceof Uint8Array
const uint8ArrayType = new t.Type(
	"Uint8Array",
	isUint8Array,
	(i, context) => (isUint8Array(i) ? t.success(i) : t.failure(i, context)),
	t.identity
)

const binaryBlockType: t.Type<BinaryBlock> = t.type({
	chain: chainType,
	chainId: chainIdType,
	blocknum: t.number,
	blockhash: uint8ArrayType,
	timestamp: t.number,
})

const binaryMessageType: t.Type<BinaryMessage> = t.type({
	hash: uint8ArrayType,
	signature: uint8ArrayType,
	session: t.union([
		t.null,
		t.type({
			hash: uint8ArrayType,
			signature: uint8ArrayType,
			payload: t.type({
				from: uint8ArrayType,
				spec: t.string,
				timestamp: t.number,
				address: uint8ArrayType,
				duration: t.number,
				block: t.union([t.null, binaryBlockType]),
			}),
		}),
	]),
	payload: t.type({
		call: t.string,
		args: actionArgumentArrayType,
		from: uint8ArrayType,
		spec: t.string,
		timestamp: t.number,
		block: t.union([t.null, binaryBlockType]),
	}),
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

export function decodeBinaryMessage(
	data: Uint8Array
): [{ hash: string; action: Action }, { hash: string | null; session: Session | null }] {
	const result = binaryMessageType.decode(cbor.decode(data))
	if (result._tag === "Left") {
		throw new Error("decodeBinaryMessage: invalid binary message")
	}

	const {
		hash,
		session: binarySession,
		signature,
		payload: { from, block, ...payload },
	} = result.right

	const session = binarySession && fromBinarySession({ type: "session", ...binarySession })
	const action: Action = {
		session: session && session.payload.address,
		signature: hexlify(signature).toLowerCase(),
		payload: { ...payload, from: hexlify(from).toLowerCase() },
	}

	if (block !== null) {
		action.payload.block = fromBinaryBlock(block)
	}

	return [
		{ hash: hexlify(hash).toLowerCase(), action },
		{ hash: binarySession && hexlify(binarySession.hash).toLowerCase(), session },
	]
}
