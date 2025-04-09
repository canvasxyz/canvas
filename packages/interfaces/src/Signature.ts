export type Signature = {
	codec: string // "dag-cbor" | "dag-json" | "canvas-action-eip712" | "canvas-session-eip712" | "canvas-snapshot"
	publicKey: string // did:key URI, or empty string if snapshot
	signature: Uint8Array
}
