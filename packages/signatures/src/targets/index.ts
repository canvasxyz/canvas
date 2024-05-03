import type { Action, Session, SignatureScheme, Signer } from "@canvas-js/interfaces"

export interface PlatformTarget {
	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void

	getDomain(): string
}
