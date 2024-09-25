import { PropertyType } from "../../modeldb/lib/types.js"

export type Snapshot = {
	type: "snapshot"
	models: Record<string, Uint8Array[]>
	effects: SnapshotEffect[]
	contract: SnapshotContract
}

export type SnapshotEffect = {
	key: string // `${model}/${hash(key)}/${version}
	value: Uint8Array | null // cbor.encode(value)
}

export type SnapshotContract = { hash: string | null } & (
	| { file: string }
	| { actions: SnapshotActionSchema; models: SnapshotModelSchema }
)

export type SnapshotActionSchema = Record<string, string>
export type SnapshotModelSchema = Record<string, Record<string, string | string[]>>
