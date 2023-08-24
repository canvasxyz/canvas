import type { Message } from "@canvas-js/interfaces"

import { bytesToHex, hexToBytes } from "@noble/hashes/utils"

export class ReferenceSet {
	private readonly parents = new Set<string>()

	constructor(parents: Uint8Array[] | null) {
		for (const parent of parents ?? []) {
			this.parents.add(bytesToHex(parent))
		}
	}

	public update(key: Uint8Array, message: Message) {
		for (const parent of message.parents) {
			this.parents.delete(bytesToHex(parent))
		}

		this.parents.add(bytesToHex(key))
	}

	public getParents(): Uint8Array[] {
		return [...this.parents.keys()].map(hexToBytes)
	}
}
