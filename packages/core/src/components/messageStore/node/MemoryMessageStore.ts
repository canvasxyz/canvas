import path from "node:path"
import fs from "node:fs"

import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events"

import type { Action, Session, ActionArgument, CustomAction, Message } from "@canvas-js/interfaces"

import { mapEntries, toHex, stringify, signalInvalidType, assert, fromHex } from "@canvas-js/core/utils"
import { MESSAGE_DATABASE_FILENAME, MST_DIRECTORY_NAME } from "@canvas-js/core/constants"

import { getMessageKey } from "@canvas-js/core/sync"

import type { MessageStore, Node, MessageStoreEvents, ReadOnlyTransaction, ReadWriteTransaction } from "../types.js"

import { MemoryTree } from "@canvas-js/okra-memory"

export class MemoryMessageStore extends EventEmitter<MessageStoreEvents> implements MessageStore {
	public static async initialize(app: string, sources: Set<string> = new Set([])) {
		const trees = new Map<string, MemoryTree>()
		for (const uri of [app, ...sources]) {
			const tree = await MemoryTree.open()
			trees.set(uri, tree)
		}

		return new MemoryMessageStore(app, trees)
	}

	private messages = new Map<string, Message>()
	private sessionAddresses = new Map<string, Uint8Array>()
	private merkleRoots: Record<string, string> = {}
	private constructor(readonly app: string, readonly trees: Map<string, MemoryTree>) {
		super()
	}

	public async *getMessageStream(
		filter: { type?: Message["type"]; limit?: number; app?: string } = {}
	): AsyncIterable<[Uint8Array, Message]> {
		const limit = filter.limit ?? Infinity
		let i = 0
		for (const [id, message] of this.messages) {
			if (i >= limit) {
				break
			}

			const app = message.type === "customAction" ? message.app : message.payload.app
			if (filter.type !== undefined && filter.type !== message.type) {
				continue
			} else if (filter.app !== undefined && filter.app !== app) {
				continue
			} else {
				yield [fromHex(id), message]
				i++
			}
		}
	}

	async close() {
		this.messages.clear()
	}

	async read<T = void>(
		callback: (txn: ReadOnlyTransaction) => T | Promise<T>,
		options: { uri?: string | undefined } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		const tree = this.trees.get(uri)
		assert(tree !== undefined)

		return await callback({
			uri,
			source: tree,
			getMessage: async (id) => this.messages.get(toHex(id)) ?? null,
			getSessionByAddress: async (chain, address) => {
				const id = this.sessionAddresses.get(address)
				if (id !== undefined) {
					const session = this.messages.get(toHex(id))
					if (session !== undefined && session.type === "session") {
						return [toHex(id), session]
					}
				}
				return [null, null]
			},
		})
	}

	async write<T = void>(
		callback: (txn: ReadWriteTransaction) => T | Promise<T>,
		options: { uri?: string | undefined } = {}
	): Promise<T> {
		const uri = options.uri ?? this.app
		const tree = this.trees.get(uri)
		assert(tree !== undefined)

		const result = await callback({
			uri,
			target: tree,
			getMessage: async (id) => this.messages.get(toHex(id)) ?? null,
			getSessionByAddress: async (chain, address) => {
				const id = this.sessionAddresses.get(address)
				if (id !== undefined) {
					const session = this.messages.get(toHex(id))
					if (session !== undefined && session.type === "session") {
						return [toHex(id), session]
					}
				}
				return [null, null]
			},
			insertMessage: async (id, message) => {
				this.messages.set(toHex(id), message)
				this.sessionAddresses.set(message.payload.sessionAddress, id)
				const key = getMessageKey(id, message)
				await tree.set(key, id)
			},
		})

		const root = await tree.getRoot()
		this.merkleRoots[uri] = toHex(root.hash)

		return result
	}

	getMerkleRoots(): Record<string, string> {
		return this.merkleRoots
	}
}
