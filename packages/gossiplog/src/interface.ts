import type { SyncSource, Awaitable } from "@canvas-js/okra"

export interface SyncSnapshot extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}
