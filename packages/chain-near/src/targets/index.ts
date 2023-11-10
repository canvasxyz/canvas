import { Session } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"

export interface PlatformTarget {
	getSessionStore: () => {
		get(topic: string, address: string): { session: Session; signer: Ed25519Signer } | null
		set(topic: string, address: string, sesion: Session, signer: Ed25519Signer): void
		clear(topic: string): void
	}
}
