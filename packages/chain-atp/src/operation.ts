import { sha256 } from "@noble/hashes/sha256"
import * as cbor from "@ipld/dag-cbor"

import { base64url } from "multiformats/bases/base64"
import { base32 } from "multiformats/bases/base32"
import { verifySignature } from "@atproto/crypto"

import { assert } from "./utils.js"

type CreateOperation = {
	sig: string
	prev: null
	type: "create"
	handle: string
	service: string
	signingKey: string
	recoveryKey: string
}

type UpdateOperation = {
	sig: string
	prev: string | null
	type: "plc_operation"
	services: {
		atproto_pds: { type: string; endpoint: string }
	}
	alsoKnownAs: string[]
	rotationKeys: string[]
	verificationMethods: {
		atproto: string
	}
}

type TombstoneOperation = {
	sig: string
	prev: string
	type: "plc_tombstone"
}

export type Operation = CreateOperation | UpdateOperation | TombstoneOperation

export async function verifyLog(did: string, plcOperationLog: Operation[]): Promise<string> {
	let verificationMethod: string | null = null

	for (const [i, operation] of plcOperationLog.entries()) {
		if (i === 0) {
			const hash = sha256(cbor.encode(operation))
			assert(did === `did:plc:${base32.baseEncode(hash).slice(0, 24)}`)
		}

		const { sig, ...unsignedOperation } = operation
		const signature = base64url.baseDecode(sig)
		const data = cbor.encode(unsignedOperation)

		let keysToCheck: string[]
		if (operation.type === "create") {
			verificationMethod == operation.signingKey
			keysToCheck = [operation.signingKey]
		} else if (operation.type === "plc_operation") {
			verificationMethod = operation.verificationMethods.atproto
			keysToCheck = operation.rotationKeys
		} else if (operation.type === "plc_tombstone") {
			throw new Error("invalid operation type")
		} else {
			throw new Error("invalid operation type")
		}

		await verifySignatureAnyMatch(keysToCheck, data, signature)
	}

	assert(verificationMethod !== null)
	return verificationMethod
}

async function verifySignatureAnyMatch(keys: string[], data: any, signature: Uint8Array) {
	for (const key of keys) {
		const valid = await verifySignature(key, data, signature)
		if (valid) {
			return
		}
	}

	throw new Error("invalid operation signature")
}
