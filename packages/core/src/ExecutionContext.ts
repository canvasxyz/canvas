import * as cbor from "@ipld/dag-cbor"

import { Action, Session, Snapshot } from "@canvas-js/interfaces"
import { ModelValue, PropertyValue, validateModelValue, updateModelValues, mergeModelValues } from "@canvas-js/modeldb"
import { AbstractGossipLog, MessageId, SignedMessage, MIN_MESSAGE_ID, MAX_MESSAGE_ID } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"

import { getRecordId } from "./utils.js"

import { WriteRecord } from "./runtime/AbstractRuntime.js"

export class ExecutionContext {
	// // recordId -> { version, value }
	// public readonly reads: Record<string, { version: string | null; value: ModelValue | null }> = {}

	// recordId -> { model, value, csx }
	public readonly writes: Map<string, { model: string; key: string; value: ModelValue | null; csx: number | null }> =
		new Map()

	// public readonly modelEntries: Record<string, Record<string, ModelValue | null>>

	public readonly root: MessageId[]

	constructor(
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly address: string,
	) {
		// this.modelEntries = mapValues(messageLog.db.models, () => ({}))
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
	): Promise<T | null> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const recordId = getRecordId(model, key)

		if (this.writes.has(recordId)) {
			const { value } = this.writes.get(recordId)!
			return value as T | null
		}

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

	public async setModelValue(model: string, value: ModelValue, transaction: boolean): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		validateModelValue(this.db.models[model], value)
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transaction) {
			csx = await this.getConflictSetIndex(recordId)
		}

		this.writes.set(recordId, { model, key, value, csx })
	}

	public async deleteModelValue(model: string, key: string, transaction: boolean): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transaction) {
			csx = await this.getConflictSetIndex(recordId)
		}

		this.writes.set(recordId, { model, key, value: null, csx })
	}

	public async updateModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transaction: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key, transaction)
		const result = updateModelValues(value, previousValue)
		await this.setModelValue(model, result, transaction)
	}

	public async mergeModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transaction: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key, transaction)
		const result = mergeModelValues(value, previousValue)
		await this.setModelValue(model, result, transaction)
	}

	public async getConflictSetIndex(recordId: string): Promise<number> {
		type Write = { record_id: string; message_id: string; csx: number | null }

		let baseCSX: number | null = null

		for await (const write of this.db.iterate<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId, message_id: { lt: this.id } },
			orderBy: { "record_id/message_id": "desc" },
		})) {
			if (write.csx === null) {
				continue
			}

			const isAncestor = await this.isAncestor(write.message_id)
			if (!isAncestor) {
				continue
			}

			// we call the first write we encounter "baseCSX"
			baseCSX = write.csx
			break
		}

		if (baseCSX === null) {
			return 1
		}

		// baseCSX is *probably* the final CSX, but we still have to check
		// for other 'intermediate' messages descending from other members
		// of baseCSX that are also ancestors.

		let id: string | null = null
		do {
			baseCSX += 1
			id = await this.getGreatestElement(recordId, baseCSX)
		} while (id !== null)

		return baseCSX
	}

	public async getGreatestElement(recordId: string, csx: number): Promise<string | null> {
		type Write = { record_id: string; message_id: string; csx: number | null }

		for await (const write of this.db.iterate<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId, csx, message_id: { lt: this.id } },
			orderBy: { "record_id/csx/message_id": "desc" },
		})) {
			const isAncestor = await this.isAncestor(write.message_id)
			if (!isAncestor) {
				continue
			}

			return write.message_id
		}

		return null
	}
}
