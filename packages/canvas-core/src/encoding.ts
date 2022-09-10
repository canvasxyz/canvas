import { createHash } from "node:crypto"

import type { Chain, ChainId, ActionArgument, Block, Session, Action } from "@canvas-js/interfaces"
import { ethers } from "ethers"
import * as cbor from "microcbor"
import assert from "node:assert"

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
		block?: BinaryBlock
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
		block?: BinaryBlock
	}
}

const toBinaryBlock = (block: Block): BinaryBlock => ({
	...block,
	blockhash: ethers.utils.arrayify(block.blockhash),
})

const fromBinaryBlock = (binaryBlock: BinaryBlock): Block => ({
	...binaryBlock,
	blockhash: ethers.utils.hexlify(binaryBlock.blockhash),
})

const toBinarySession = (session: Session): BinarySession => ({
	type: "session",
	signature: ethers.utils.arrayify(session.signature),
	payload: {
		...session.payload,
		from: ethers.utils.arrayify(session.payload.from),
		address: ethers.utils.arrayify(session.payload.address),
		block: session.payload.block && toBinaryBlock(session.payload.block),
	},
})

const fromBinarySession = (binarySession: BinarySession): Session => ({
	signature: ethers.utils.hexlify(binarySession.signature),
	payload: {
		...binarySession.payload,
		from: ethers.utils.hexlify(binarySession.payload.from),
		address: ethers.utils.hexlify(binarySession.payload.address),
		block: binarySession.payload.block && fromBinaryBlock(binarySession.payload.block),
	},
})

const toBinaryAction = (action: Action): BinaryAction => ({
	type: "action",
	signature: ethers.utils.arrayify(action.signature),
	session: action.session ? ethers.utils.arrayify(action.session) : null,
	payload: {
		...action.payload,
		from: ethers.utils.arrayify(action.payload.from),
		block: action.payload.block && toBinaryBlock(action.payload.block),
	},
})

const fromBinaryAction = (binaryAction: BinaryAction): Action => ({
	signature: ethers.utils.hexlify(binaryAction.signature),
	session: binaryAction.session ? ethers.utils.hexlify(binaryAction.session) : null,
	payload: {
		...binaryAction.payload,
		from: ethers.utils.hexlify(binaryAction.payload.from),
		block: binaryAction.payload.block && fromBinaryBlock(binaryAction.payload.block),
	},
})

export function encodeAction(action: Action): Uint8Array {
	const binaryAction = toBinaryAction(action)
	return cbor.encode(binaryAction)
}

export function decodeAction(data: Uint8Array): Action {
	const binaryAction = cbor.decode(data) as BinaryAction
	return fromBinaryAction(binaryAction)
}

export function encodeSession(session: Session): Uint8Array {
	const binarySession = toBinarySession(session)
	return cbor.encode(binarySession)
}

export function decodeSession(data: Uint8Array): Session {
	const binarySession = cbor.decode(data) as BinarySession
	return fromBinarySession(binarySession)
}

export async function getActionHash(action: Action): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([action]))) {
		hash.update(chunk)
	}

	return ethers.utils.hexlify(hash.digest())
}

export async function getSessionhash(session: Session): Promise<string> {
	const hash = createHash("sha256")
	for await (const chunk of cbor.encodeStream(source([session]))) {
		hash.update(chunk)
	}

	return ethers.utils.hexlify(hash.digest())
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
type BinaryMessage = Omit<BinaryAction, "type" | "session"> & { session: BinarySession | null }

export function encodeBinaryMessage(action: Action, session: Session | null): Uint8Array {
	assert(
		action.session?.toLowerCase() === session?.payload.address.toLowerCase(),
		"encodeBinaryMessage: action.session does not match session"
	)

	const message: BinaryMessage = {
		signature: ethers.utils.arrayify(action.signature),
		session: session ? toBinarySession(session) : null,
		payload: {
			...action.payload,
			from: ethers.utils.arrayify(action.payload.from),
			block: action.payload.block && toBinaryBlock(action.payload.block),
		},
	}

	return cbor.encode(message)
}

export function decodeBinaryMessage(data: Uint8Array): [Action, Session | null] {
	const {
		session: binarySession,
		signature,
		payload: { from, block, ...payload },
	} = cbor.decode(data) as BinaryMessage

	const session = binarySession && fromBinarySession(binarySession)
	const action: Action = {
		session: session && session.payload.address,
		signature: ethers.utils.hexlify(signature),
		payload: {
			...payload,
			from: ethers.utils.hexlify(from),
			block: block && fromBinaryBlock(block),
		},
	}

	return [action, session]
}
