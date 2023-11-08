import type { CID } from "multiformats"

export type Signature = {
	/** did:key URI */
	publicKey: string
	signature: Uint8Array
	cid: CID
}
