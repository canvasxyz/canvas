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
	let rotationKeys: string[] = []
	let verificationMethod: string | null = null
	for (const [i, operation] of plcOperationLog.entries()) {
		await verifyOperation(operation, rotationKeys)
		if (i === 0) {
			const hash = sha256(cbor.encode(operation))
			assert(did === `did:plc:${base32.baseEncode(hash).slice(0, 24)}`)
		}

		if (operation.type === "create") {
			assert(i === 0, "expected i === 0")
			verificationMethod = operation.signingKey
			rotationKeys = [operation.signingKey]
		} else if (operation.type === "plc_operation") {
			rotationKeys = operation.rotationKeys
			verificationMethod = operation.verificationMethods.atproto
		} else if (operation.type === "plc_tombstone") {
			throw new Error("invalid operation type")
		} else {
			throw new Error("invalid operation type")
		}
	}

	assert(verificationMethod !== null)
	return verificationMethod
}

async function verifyOperation(operation: Operation, rotationKeys: string[]) {
	const { sig, ...unsignedOperation } = operation
	const signature = base64url.baseDecode(sig)
	const data = cbor.encode(unsignedOperation)
	if (operation.type === "create") {
		const result = await verifySignature(operation.signingKey, data, signature)
		assert(result, "invalid operation signature")
	} else if (operation.type === "plc_operation") {
		for (const rotationKey of rotationKeys) {
			const result = await verifySignature(rotationKey, data, signature)
			if (result) {
				return
			}
		}

		throw new Error("invalid operation signature")
	}
}
