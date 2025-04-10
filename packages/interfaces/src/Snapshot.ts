export type Snapshot = {
	type: "snapshot"
	models: Record<string, Uint8Array[]>
}
