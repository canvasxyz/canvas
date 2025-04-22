import { CID } from "multiformats"
import * as cbor from "@ipld/dag-cbor"
import { verifySignature } from "@atproto/crypto"

import { assert } from "@canvas-js/utils"

export type Commit = {
	did: string
	rev: string
	sig: Uint8Array
	data: CID
	prev: CID | null
	version: number
}

export async function verifyCommit(verificationMethod: string, commit: Commit) {
	const { sig, ...unsignedCommit } = commit
	await verifySignature(verificationMethod, cbor.encode(unsignedCommit), sig).then(assert)
}
