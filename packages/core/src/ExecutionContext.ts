import * as cbor from "@ipld/dag-cbor"

import { Action, Session, Snapshot } from "@canvas-js/interfaces"
import { mergeModelValues, ModelValue, PropertyValue, updateModelValues, validateModelValue } from "@canvas-js/modeldb"
import { AbstractGossipLog, MessageId, MIN_MESSAGE_ID, SignedMessage } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"

import { getRecordId } from "./utils.js"

import { WriteRecord } from "./runtime/AbstractRuntime.js"

export class ExecutionContext {
	// // recordId -> { version, value }
	// public readonly reads: Record<string, { version: string | null; value: ModelValue | null }> = {}

	// // recordId -> effect
	// public readonly writes: Record<string, Effect> = {}

	public readonly modelEntries: Record<string, Record<string, ModelValue | null>>
	public readonly root: MessageId[]

	constructor(
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
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

	public async getModelValue<T extends ModelValue = ModelValue>(
		model: string,
		key: string,
		transaction: boolean,
	): Promise<null | T> {
		if (this.modelEntries[model] === undefined) {
			const { name } = this.message.payload
			throw new Error(`could not access model db.${model} inside runtime action ${name}`)
		}

		if (this.modelEntries[model][key] !== undefined) {
			return this.modelEntries[model][key] as T
		}

		const recordId = getRecordId(model, key)
		const lowerBound = MIN_MESSAGE_ID
		let upperBound = this.id

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const results = await this.db.query<WriteRecord>("$writes", {
				where: { record_id: recordId, message_id: { gte: lowerBound, lt: upperBound } },
				orderBy: { "record_id/message_id": "desc" },
				limit: 1,
			})

			if (results.length === 0) {
				return null
			}

			const [{ message_id: messageId, value }] = results

			if (messageId === MIN_MESSAGE_ID) {
				assert(value !== null, "expected snapshot write to be non-null")
				return cbor.decode<T>(value)
			}

			const isAncestor = await this.isAncestor(messageId)
			if (isAncestor) {
				if (value === null) {
					return null
				} else {
					return cbor.decode<null | T>(value)
				}
			} else {
				upperBound = messageId
			}
		}
	}

	public setModelValue(model: string, value: ModelValue, transaction: boolean): void {
		assert(this.db.models[model] !== undefined, "model not found")
		validateModelValue(this.db.models[model], value)
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		assert(typeof key === "string", "expected value[primaryKey] to be a string")
		this.modelEntries[model][key] = value
	}

	public deleteModelValue(model: string, key: string, transaction: boolean): void {
		assert(this.db.models[model] !== undefined, "model not found")
		this.modelEntries[model][key] = null
	}

	public async updateModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transaction: boolean,
	): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key, transaction)
		const result = updateModelValues(value, previousValue)
		validateModelValue(this.db.models[model], result)
		this.modelEntries[model][key] = result
	}

	public async mergeModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transaction: boolean,
	): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key, transaction)
		const result = mergeModelValues(value, previousValue)
		validateModelValue(this.db.models[model], result)
		this.modelEntries[model][key] = result
	}
}
