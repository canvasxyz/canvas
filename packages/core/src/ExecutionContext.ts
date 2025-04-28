import type { MessageType, SessionSigner } from "@canvas-js/interfaces"

import { Action } from "@canvas-js/interfaces"
import { ModelValue, PropertyValue, validateModelValue, updateModelValue, mergeModelValue } from "@canvas-js/modeldb"
import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { decodeRecordValue, getRecordId } from "./utils.js"

import { View, TransactionalRead } from "./View.js"

export class ExecutionContext extends View {
	// recordId -> { version, value, csx }
	public readonly transactionalReads: Map<string, TransactionalRead | null> = new Map()

	// recordId -> value
	public readonly lwwReads: Map<string, ModelValue | null> = new Map()

	// recordId -> { model, key, value, csx }
	public readonly writes: Map<string, { model: string; key: string; value: ModelValue | null; csx: number | null }> =
		new Map()

	constructor(
		public readonly messageLog: AbstractGossipLog<MessageType>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly signer: SessionSigner,
	) {
		super(messageLog, signedMessage.parents)
	}

	public get id() {
		return this.signedMessage.id
	}

	public get signature() {
		return this.signedMessage.signature
	}

	public get publicKey() {
		return this.signature.publicKey
	}

	public get message() {
		return this.signedMessage.message
	}

	public get did() {
		return this.message.payload.did
	}

	public get address() {
		return this.signer.getAddressFromDid(this.did)
	}

	public async getModelValue<T extends ModelValue = ModelValue>(
		model: string,
		key: string,
		transactional: boolean,
	): Promise<T | null> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("getModelValue(%s, %o, %o)", model, key, transactional)

		const recordId = getRecordId(model, key)

		if (this.writes.has(recordId)) {
			const { value } = this.writes.get(recordId)!
			return value as T | null
		}

		if (transactional) {
			if (this.transactionalReads.has(recordId)) {
				const { value = null } = this.transactionalReads.get(recordId) ?? {}
				return value as T | null
			}

			const result = await this.getLastValueTransactional<T>(model, key, recordId)
			this.transactionalReads.set(recordId, result)
			return result?.value ?? null
		} else {
			if (this.lwwReads.has(recordId)) {
				const value = this.lwwReads.get(recordId)!
				return value as T | null
			}

			const write = await this.getLastValue(recordId)
			if (write === null || write.value === null) {
				this.lwwReads.set(recordId, null)
				return null
			} else {
				const value = decodeRecordValue(this.db.config, model, write.value)
				this.lwwReads.set(recordId, value)
				return value as T
			}
		}
	}

	public async setModelValue(model: string, value: ModelValue, transactional: boolean): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("setModelValue(%s, %o, %s)", model, value, transactional)

		validateModelValue(this.db.models[model], value)
		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transactional) {
			const [previousCSX] = await this.getLatestConflictSet(recordId)
			csx = (previousCSX ?? 0) + 1
		}

		this.writes.set(recordId, { model, key, value, csx })
	}

	public async deleteModelValue(model: string, key: string, transactional: boolean): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		this.log("deleteModelValue(%s, %o, %s)", model, key, transactional)

		const recordId = getRecordId(model, key)
		let csx: number | null = null
		if (transactional) {
			const [previousCSX] = await this.getLatestConflictSet(recordId)
			csx = (previousCSX ?? 0) + 1
		}

		this.writes.set(recordId, { model, key, value: null, csx })
	}

	public async updateModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transactional: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string
		const previousValue = await this.getModelValue(model, key, transactional)
		const result = updateModelValue(value, previousValue)
		await this.setModelValue(model, result, transactional)
	}

	public async mergeModelValue(
		model: string,
		value: Record<string, PropertyValue | undefined>,
		transactional: boolean,
	): Promise<void> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		const {
			primaryKey: [primaryKey],
		} = this.db.models[model]
		const key = value[primaryKey] as string

		const previousValue = await this.getModelValue(model, key, transactional)
		const result = mergeModelValue(value, previousValue)
		await this.setModelValue(model, result, transactional)
	}
}
