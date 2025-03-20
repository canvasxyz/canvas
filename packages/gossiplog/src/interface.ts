import type { Awaitable } from "@canvas-js/utils"
import type { SyncSource } from "@canvas-js/okra"

export interface SyncSnapshot extends SyncSource {
	getValues(keys: Uint8Array[]): Awaitable<Uint8Array[]>
}
