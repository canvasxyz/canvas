import type { CID } from "multiformats"

export type SignatureType = "ed25519" | "secp256k1"

export type Signature = {
	type: SignatureType
	publicKey: Uint8Array
	signature: Uint8Array
	cid: CID
}
