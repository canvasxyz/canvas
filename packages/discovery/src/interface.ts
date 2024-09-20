export type DiscoveryRecord = {
	id: Uint8Array
	addresses: Uint8Array[]
	protocols: string[]
	peerRecordEnvelope: Uint8Array | null
}
