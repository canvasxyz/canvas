import type { SyncSource, Awaitable } from "@canvas-js/okra"

export interface Snapshot extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}
