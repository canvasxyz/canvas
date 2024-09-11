export type Snapshot = {
	type: "snapshot"

	actions: Record<string, string>
	models: Record<string, Record<string, string>>
	effects: Uint8Array
	tables: string
}
