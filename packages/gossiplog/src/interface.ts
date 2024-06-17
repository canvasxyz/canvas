import type { SyncSource, Awaitable } from "@canvas-js/okra"

export interface SyncServer extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}
