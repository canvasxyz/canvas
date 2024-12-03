import * as cbor from "@ipld/dag-cbor"

import { verifySignature } from "@atproto/crypto"
import { base64url } from "multiformats/bases/base64"
import { base32 } from "multiformats/bases/base32"
import { CID } from "multiformats"
import { sha256 } from "multiformats/hashes/sha2"

import { assert } from "@canvas-js/utils"

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

async function getCID(operation: Operation): Promise<CID> {
	const operationBytes = cbor.encode(operation)
	const multihashDigest = await sha256.digest(operationBytes)
	return CID.createV1(cbor.code, multihashDigest)
}

export async function verifyLog(did: string, plcOperationLog: Operation[]): Promise<string> {
	let verificationMethod: string | null = null
	let rotationKeys: string[] = []
	let prev: string | null = null

	for (const [i, operation] of plcOperationLog.entries()) {
		assert(operation.prev === prev, "operation log verification failure: invalid operation.prev CID")

		const cid = await getCID(operation)
		prev = cid.toString()

		if (i === 0) {
			const expectedDid = base32.baseEncode(cid.multihash.digest).slice(0, 24)
			assert(
				did === `did:plc:${expectedDid}`,
				"operation log verification failure: DID does not match the genesis operation",
			)
		}

		const { sig, ...unsignedOperation } = operation
		const signature = base64url.baseDecode(sig)
		const data = cbor.encode(unsignedOperation)

		if (i === 0) {
			if (operation.type === "create") {
				verificationMethod = operation.signingKey
				rotationKeys = [operation.signingKey]
			} else if (operation.type === "plc_operation") {
				verificationMethod = operation.verificationMethods.atproto
				rotationKeys = operation.rotationKeys
			} else {
				throw new Error("invalid operation typr")
			}
		}

		await verifySignatureAnyMatch(rotationKeys, data, signature)

		if (i > 0) {
			if (operation.type === "plc_operation") {
				verificationMethod = operation.verificationMethods.atproto
				rotationKeys = operation.rotationKeys
			} else if (operation.type === "plc_tombstone") {
				throw new Error("invalid operation type")
			} else {
				throw new Error("invalid operation type")
			}
		}
	}

	assert(verificationMethod !== null)
	return verificationMethod
}

async function verifySignatureAnyMatch(keys: string[], data: Uint8Array, signature: Uint8Array) {
	for (const key of keys) {
		const valid = await verifySignature(key, data, signature)
		if (valid) {
			return
		}
	}

	throw new Error("invalid operation signature")
}
