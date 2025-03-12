import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"

import type { Action, MessageType } from "@canvas-js/interfaces"

import { ModelValue, PropertyValue, validateModelValue, updateModelValue, mergeModelValue } from "@canvas-js/modeldb"
import { AbstractGossipLog, SignedMessage, MessageId } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"

export const getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

export class ExecutionContext {
	// // recordId -> { version, value }
	// public readonly reads: Record<string, { version: string | null; value: ModelValue | null }> = {}

	// // recordId -> effect
	// public readonly writes: Record<string, Effect> = {}

	public readonly modelEntries: Record<string, Record<string, ModelValue | null>>
	public readonly root: MessageId[]

	constructor(
		public readonly messageLog: AbstractGossipLog<MessageType>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly address: string,
	) {
		this.modelEntries = mapValues(messageLog.db.models, () => ({}))
		this.root = signedMessage.message.parents.map((id) => MessageId.encode(id))
	}

	public get id() {
		return this.signedMessage.id
	}

	public get signature() {
		return this.signedMessage.signature
	}

	public get message() {
		return this.signedMessage.message
	}

	public get db() {
		return this.messageLog.db
	}

	public async isAncestor(ancestor: string | MessageId): Promise<boolean> {
		return await this.messageLog.isAncestor(this.root, ancestor)
	}

	public async getModelValue<T extends ModelValue = ModelValue>(model: string, key: string): Promise<null | T> {
		if (this.modelEntries[model] === undefined) {
			const { name } = this.message.payload
			throw new Error(`could not access model db.${model} inside runtime action ${name}`)
		}

		if (this.modelEntries[model][key] !== undefined) {
			return this.modelEntries[model][key] as T
		}

		const keyHash = getKeyHash(key)
		const lowerBound = `${model}/${keyHash}/`

		let upperBound = `${model}/${keyHash}/${this.id}`

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const results = await this.db.query<{ key: string; value: Uint8Array; clock: number }>("$effects", {
				select: { key: true, value: true, clock: true },
				where: { key: { gt: lowerBound, lt: upperBound } },
				orderBy: { key: "desc" },
				limit: 1,
			})

			if (results.length === 0) {
				return null
			}

			if (results[0].clock === 0) {
				if (results[0].value === null) return null
				return cbor.decode<null | T>(results[0].value)
			}

			const [effect] = results
			const [{}, {}, messageId] = effect.key.split("/")

			const isAncestor = await this.isAncestor(messageId)
			if (isAncestor) {
				if (effect.value === null) {
					return null
				} else {
					return cbor.decode<null | T>(effect.value)
				}
			} else {
				upperBound = effect.key
			}
		}
	}

	public setModelValue(model: string, value: ModelValue): void {
		assert(this.db.models[model] !== undefined, "model not found")
		validateModelValue(this.db.models[model], value)
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		assert(typeof key === "string", "expected value[primaryKey] to be a string")
		this.modelEntries[model][key] = value
	}

	public deleteModelValue(model: string, key: string): void {
		assert(this.db.models[model] !== undefined, "model not found")
		this.modelEntries[model][key] = null
	}

	public async updateModelValue(model: string, value: Record<string, PropertyValue | undefined>): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key)
		const result = updateModelValue(value, previousValue)
		validateModelValue(this.db.models[model], result)
		this.modelEntries[model][key] = result
	}

	public async mergeModelValue(model: string, value: Record<string, PropertyValue | undefined>): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key)
		const result = mergeModelValue(value, previousValue)
		validateModelValue(this.db.models[model], result)
		this.modelEntries[model][key] = result
	}
}
