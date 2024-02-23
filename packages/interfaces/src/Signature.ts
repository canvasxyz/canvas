export type Signature = {
	codec: string // "dag-cbor" | "eip712"
	publicKey: string // did:key URI
	signature: Uint8Array
}
