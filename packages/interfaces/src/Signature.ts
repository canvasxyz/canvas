import type { CID } from "multiformats"

export type Signature = {
	/** did:key URI */
	publicKey: string
	signature: Uint8Array
	cid: CID
}

export interface Signer<T = any> {
	sign(value: T): Signature
}
