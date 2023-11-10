import type * as ATP from "@atproto/api"

import type { Session } from "@canvas-js/interfaces"
import { Secp256k1Signer } from "@canvas-js/signed-cid"

import type { PlatformTarget } from "../index.js"

class SessionStore {
	#cache = new Map<string, { session: Session; signer: Secp256k1Signer }>()

	constructor() {}

	private getKey(topic: string, address: string) {
		return `canvas/${topic}/${address}`
	}

	public create() {
		return new Secp256k1Signer()
	}

	public get(topic: string, address: string): { session: Session; signer: Secp256k1Signer } | null {
		const key = this.getKey(topic, address)
		return this.#cache.get(key) ?? null
	}

	public set(topic: string, address: string, session: Session, signer: Secp256k1Signer): void {
		const key = this.getKey(topic, address)
		this.#cache.set(key, { session, signer })
	}

	public clear(topic: string): void {
		for (const key of this.#cache.keys()) {
			if (key.startsWith(`canvas/${topic}/`)) {
				this.#cache.delete(key)
			}
		}
	}
}

export default {
	getSessionStore() {
		return new SessionStore()
	},
	saveJWTSession(data: ATP.AtpSessionData) {},
	loadJWTSession(): ATP.AtpSessionData | null {
		return null
	},
} satisfies PlatformTarget
