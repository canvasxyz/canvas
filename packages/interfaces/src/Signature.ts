export type Signature = {
	codec: string // "dag-cbor" | "dag-json" | "canvas-action-eip712" | "canvas-session-eip712"
	publicKey: string // did:key URI
	signature: Uint8Array
}
