import * as json from "@ipld/dag-json"

import { Action, Session, SignatureScheme, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import type { PlatformTarget, SignerStore } from "../index.js"

export default {
	getSignerStore: (scheme) => new BrowserSignerStore(scheme),

	get(key: string): string | null {
		return window.localStorage.getItem(key)
	},
	set(key: string, value: string) {
		window.localStorage.setItem(key, value)
	},
	clear(prefix: string = "") {
		const keyToRemove: string[] = []
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key?.startsWith(prefix)) {
				keyToRemove.push(key)
			}
		}

		keyToRemove.forEach((key) => localStorage.removeItem(key))
	},

	getDomain() {
		return window.location.host
	},
} satisfies PlatformTarget

const getKey = (topic: string, address: string) => `canvas/${topic}/${address}`

class BrowserSignerStore<AuthorizationData> implements SignerStore<AuthorizationData> {
	#cache = new Map<string, Signer<Action | Session<AuthorizationData>>>()

	constructor(public readonly scheme: SignatureScheme<Action | Session<AuthorizationData>>) {}

	get(topic: string, address: string): Signer<Action | Session<AuthorizationData>> | null {
		const key = getKey(topic, address)

		if (!this.#cache.has(key)) {
			const value = window.localStorage.getItem(key)
			if (value === null) {
				return null
			}

			const {
				signer: { type, privateKey },
			} = json.parse<{ signer: { type: string; privateKey: Uint8Array } }>(value)

			assert(typeof type === "string", 'expected typeof type === "string"')
			assert(privateKey instanceof Uint8Array, "expected privateKey instanceof Uint8Array")

			const signer = this.scheme.create({ type, privateKey })
			this.#cache.set(key, signer)
			return signer
		}

		return this.#cache.get(key) ?? null
	}

	set(topic: string, address: string, signer: Signer<Action | Session<AuthorizationData>>): void {
		const key = getKey(topic, address)
		this.#cache.set(key, signer)
		window.localStorage.setItem(key, json.stringify({ signer: signer.export() }))
	}

	clear(topic: string): void {
		const prefix = getKey(topic, "")

		const keyToRemove: string[] = []
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key?.startsWith(prefix)) {
				this.#cache.delete(key)
				keyToRemove.push(key)
			}
		}

		keyToRemove.forEach((key) => localStorage.removeItem(key))
	}
}
