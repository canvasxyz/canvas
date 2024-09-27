export type Snapshot = {
	type: "snapshot"
	models: Record<string, Uint8Array[]>
	effects: SnapshotEffect[]
}

export type SnapshotEffect = {
	key: string // `${model}/${hash(key)}/${version}
	value: Uint8Array | null // cbor.encode(value)
}
