import { Action, Session, Signer } from "@canvas-js/interfaces"

export interface SignerStore<AuthorizationData> {
	get(topic: string, address: string): Signer<Action | Session<AuthorizationData>> | null
	set(topic: string, address: string, signer: Signer<Action | Session<AuthorizationData>>): void
	clear(topic?: string): void
}

export interface PlatformTarget {
	getSignerStore<AuthorizationData>(options: {
		createSigner: (init?: { type: string; privateKey: Uint8Array }) => Signer<Action | Session<AuthorizationData>>
	}): SignerStore<AuthorizationData>

	get(key: string): string | null
	set(key: string, value: string): void
	clear(prefix?: string): void

	getDomain(): string
}
