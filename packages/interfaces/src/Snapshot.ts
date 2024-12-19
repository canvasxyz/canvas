export type Snapshot = {
	type: "snapshot"
	models: Record<string, Uint8Array[]>
	effects: SnapshotEffect[]
}

export type SnapshotEffect = {
	model: string
	key: string
	value: Uint8Array | null // cbor.encode(value) | null
}
