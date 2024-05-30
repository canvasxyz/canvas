import fs from "node:fs"
import { equals } from "uint8arrays"
import { CustomEvent } from "@libp2p/interface"

import { Bound } from "@canvas-js/okra"
import { Database, Environment, Transaction, Tree } from "@canvas-js/okra-node"
import { Message, Signature } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { KEY_LENGTH, encodeId, encodeSignedMessage } from "../schema.js"
import { AbstractGossipLog, GossipLogInit, ReadOnlyTransaction, ReadWriteTransaction } from "../AbstractGossipLog.js"
import { getAncestors, indexAncestors, isAncestor } from "../ancestors.js"
import { cborNull } from "../utils.js"

export class GossipLog<Payload> extends AbstractGossipLog<Payload> {
	public static async open<Payload>(init: GossipLogInit<Payload>, path: string): Promise<GossipLog<Payload>> {
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path, { recursive: true })
		}

		const env = new Environment(path, { databases: 3, mapSize: Math.pow(2, 36) })
		const gossipLog = new GossipLog(env, init)
		await gossipLog.write(async (txn) => {})

		return gossipLog
	}

	private constructor(private readonly env: Environment, init: GossipLogInit<Payload>) {
		super(init)
	}

	public async close() {
		this.log("closing")
		await this.env.close()
	}

	public async *entries(
		lowerBound: Bound<Uint8Array> | null = null,
		upperBound: Bound<Uint8Array> | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[key: Uint8Array, value: Uint8Array]> {
		const txn = new Transaction(this.env, { readOnly: true })

		const messages = new Tree(txn, "messages")
		try {
			for await (const node of messages.nodes(0, lowerBound ?? { key: null, inclusive: false }, upperBound, options)) {
				assert(node.key !== null, "expected node.key !== null")
				assert(node.value !== undefined, "expected node.value !== undefined")
				yield [node.key, node.value]
			}
		} finally {
			messages.close()
			txn.abort()
		}
	}

	public async read<T>(callback: (txn: ReadOnlyTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-only transaction")
		return await this.env.read(async (txn) => {
			const messages = new Tree(txn, "messages")
			const heads = txn.database("heads")
			const ancestors = txn.database("ancestors")

			try {
				return await callback({
					getHeads: () => getHeads(heads),
					getAncestors: async (key: Uint8Array, atOrBefore: number, results: Set<string>) =>
						getAncestors(ancestors, key, atOrBefore, results),
					isAncestor: (key: Uint8Array, ancestorKey: Uint8Array, visited = new Set<string>()) =>
						isAncestor(ancestors, key, ancestorKey, visited),

					messages,
				})
			} finally {
				messages.close()
			}
		})
	}

	public async write<T>(callback: (txn: ReadWriteTransaction) => Promise<T>): Promise<T> {
		this.log("opening read-write transaction")
		const { result, root } = await this.env.write(async (txn) => {
			const heads = txn.database("heads")
			const ancestors = txn.database("ancestors")
			const messages = new Tree(txn, "messages")
			try {
				const result = await callback({
					getHeads: () => getHeads(heads),
					getAncestors: async (key: Uint8Array, atOrBefore: number, results: Set<string>) =>
						getAncestors(ancestors, key, atOrBefore, results),
					isAncestor: (key: Uint8Array, ancestorKey: Uint8Array, visited = new Set<string>()) =>
						isAncestor(ancestors, key, ancestorKey, visited),

					insert: async (
						signature: Signature,
						message: Message,
						[key, value] = encodeSignedMessage(signature, message),
					) => {
						messages.set(key, value)

						const parentKeys = message.parents.map(encodeId)

						heads.set(key, cborNull)
						for (const parentKey of parentKeys) {
							heads.delete(parentKey)
						}

						if (this.indexAncestors) {
							await indexAncestors(ancestors, key, parentKeys)
						}
					},

					messages,
				})

				return { result, root: messages.getRoot() }
			} finally {
				messages.close()
			}
		})

		this.dispatchEvent(new CustomEvent("commit", { detail: { root } }))
		return result
	}
}

async function getHeads(heads: Database) {
	const parents: Uint8Array[] = []

	for await (const [key, value] of heads.entries()) {
		assert(key.byteLength === KEY_LENGTH, "internal error (expected key.byteLength === KEY_LENGTH)")
		assert(equals(value, cborNull), "internal error (unexpected parent entry value)")
		parents.push(key)
	}

	return parents
}
