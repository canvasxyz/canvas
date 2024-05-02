import os from "node:os"

import type { Action, Session, Signer } from "@canvas-js/interfaces"
import type { PlatformTarget, SignerStore } from "../index.js"

const cache = new Map<string, string>()

export default {
	getSignerStore: ({}) => new MemorySignerStore(),

	get(key: string): any | null {
		return cache.get(key) ?? null
	},
	set(key: string, value: any) {
		cache.set(key, value)
	},
	clear(prefix: string = "") {
		for (const key of cache.keys()) {
			if (key.startsWith(prefix)) {
				cache.delete(key)
			}
		}
	},

	getDomain() {
		return os.hostname()
	},
} satisfies PlatformTarget

const getKey = (topic: string, address: string) => `canvas/${topic}/${address}`

class MemorySignerStore<AuthorizationData> implements SignerStore<AuthorizationData> {
	#cache = new Map<string, Signer<Action | Session<AuthorizationData>>>()

	constructor() {}

	get(topic: string, address: string): Signer<Action | Session<AuthorizationData>> | null {
		const key = getKey(topic, address)
		return this.#cache.get(key) ?? null
	}

	set(topic: string, address: string, signer: Signer<Action | Session<AuthorizationData>>): void {
		const key = getKey(topic, address)
		this.#cache.set(key, signer)
	}

	clear(topic: string): void {
		const prefix = getKey(topic, "")
		for (const key of this.#cache.keys()) {
			if (key.startsWith(prefix)) {
				this.#cache.delete(key)
			}
		}
	}
}
