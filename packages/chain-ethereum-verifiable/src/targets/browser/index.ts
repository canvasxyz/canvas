import * as json from "@ipld/dag-json"

import type { Session } from "@canvas-js/interfaces"
import { Secp256k1Signer } from "@canvas-js/signed-cid"

import type { PlatformTarget } from "../index.js"

class SignerStore {
	#cache = new Map<string, { session: Session; signer: Secp256k1Signer }>()

	constructor() {}

	private getKey(topic: string, address: string) {
		return `canvas/${topic}/${address}`
	}

	public create() {
		return new Secp256k1Signer()
	}

	public get(topic: string, address: string): { session: Session; signer: Secp256k1Signer } | null {
		if (this.#cache.has(address)) {
			return this.#cache.get(address) ?? null
		}

		const key = this.getKey(topic, address)
		const value = window.localStorage.getItem(key)
		if (value === null) {
			return null
		}

		const { type, privateKey, session } = json.parse<{ session: Session; type: string; privateKey: Uint8Array }>(value)
		if (type !== Secp256k1Signer.type) {
			throw new Error("invalid session signer type")
		}

		const signer = new Secp256k1Signer(privateKey)
		this.#cache.set(address, { session, signer })
		return { session, signer }
	}

	public set(topic: string, address: string, session: Session, signer: Secp256k1Signer): void {
		this.#cache.set(address, { session, signer })
		const key = this.getKey(topic, address)
		const value = json.stringify({ session, ...signer.export() })
		window.localStorage.setItem(key, value)
	}

	public clear(topic: string): void {
		const keys: string[] = []
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key?.startsWith(`canvas/${topic}/`)) {
				keys.push(key)
			}
		}

		keys.forEach((key) => localStorage.removeItem(key))
		this.#cache.clear()
	}
}

export default {
	getDomain() {
		return window.location.host
	},
	getSessionStore() {
		return new SignerStore()
	},
} satisfies PlatformTarget
