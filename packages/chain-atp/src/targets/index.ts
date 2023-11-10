import type * as ATP from "@atproto/api"

import { Session } from "@canvas-js/interfaces"
import { Secp256k1Signer } from "@canvas-js/signed-cid"

export interface PlatformTarget {
	saveJWTSession: (data: ATP.AtpSessionData) => void
	loadJWTSession: () => ATP.AtpSessionData | null
	getSessionStore: () => {
		get(topic: string, address: string): { session: Session; signer: Secp256k1Signer } | null
		set(topic: string, address: string, sesion: Session, signer: Secp256k1Signer): void
		clear(topic: string): void
	}
}
