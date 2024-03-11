import { Action, Session, Signer } from "@canvas-js/interfaces"

export interface SessionStore<AuthorizationData> {
	get(topic: string, address: string): { session: Session; signer: Signer<Action | Session<AuthorizationData>> } | null
	set(topic: string, address: string, session: Session, signer: Signer<Action | Session<AuthorizationData>>): void
	clear(topic: string): void
}

export interface PlatformTarget {
	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void

	getDomain(): string
}
