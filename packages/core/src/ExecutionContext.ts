import * as cbor from "@ipld/dag-cbor"

import { logger } from "@libp2p/logger"
import type { MessageType } from "@canvas-js/interfaces"

import { Action } from "@canvas-js/interfaces"
import { ModelValue, PropertyValue, validateModelValue, updateModelValues, mergeModelValues } from "@canvas-js/modeldb"
import { AbstractGossipLog, MessageId, SignedMessage, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { getRecordId } from "./utils.js"

import { RevertRecord, WriteRecord } from "./runtime/AbstractRuntime.js"

type TransactionalRead<T extends ModelValue = ModelValue> = {
	version: string
	value: T | null
	csx: number
}

export class ExecutionContext {
	// recordId -> { version, value, csx }
	public readonly transactionalReads: Map<string, TransactionalRead | null> = new Map()
	// recordId -> value
	public readonly lwwReads: Map<string, ModelValue | null> = new Map()

	// recordId -> { model, key, value, csx }
	public readonly writes: Map<string, { model: string; key: string; value: ModelValue | null; csx: number | null }> =
		new Map()

	public readonly root: MessageId[]

	private readonly log = logger("canvas:runtime:exec")

	constructor(
		public readonly messageLog: AbstractGossipLog<MessageType>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly address: string,
	) {
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

	public async isAncestor(root: MessageId[], ancestor: string | MessageId): Promise<boolean> {
		return await this.messageLog.isAncestor(root, ancestor)
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

			const result = await this.getLastValueTransactional<T>(this.root, recordId)
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
				const value = cbor.decode<T>(write.value)
				this.lwwReads.set(recordId, value)
				return value
			}
		}
	}

	public async getLastValueTransactional<T extends ModelValue>(
		root: MessageId[],
		recordId: string,
		reverted?: Set<string>,
	): Promise<TransactionalRead<T> | null> {
		let [csx, messageId] = await this.getLatestConflictSet(root, recordId)
		if (csx === null || messageId === null) {
			return null
		}

		this.log.trace("got latest conflict set [%d, %s] w/r/t roots %s", csx, messageId, root.toString())

		// this iterates backward over the greatest element of each conflict set
		// and returns the value of the first non-reverted write.
		// eslint-disable-next-line no-constant-condition
		while (true) {
			let isReverted = reverted?.has(messageId)
			isReverted ??= await this.isReverted(root, messageId)
			this.log.trace("isReverted(%s): %o", messageId, isReverted)
			if (!isReverted) {
				const write = await this.db.get<WriteRecord>("$writes", [recordId, messageId])
				assert(write !== null, "internal error - missing write record")
				const value = write.value && cbor.decode<T>(write.value)
				this.log.trace("returning write value %o", value)
				return { version: messageId, value, csx }
			} else if (csx > 1) {
				csx -= 1
				messageId = await this.getGreatestElement(root, recordId, csx)
				assert(messageId !== null, "internal error - failed to get greatest element")
				this.log.trace("got previous conflict set %d (%s)", csx, messageId)
			} else {
				return null
			}
		}
	}

	private async getLastValue(recordId: string, root = this.root): Promise<WriteRecord | null> {
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

			const [write] = results

			const isAncestor = await this.isAncestor(root, write.message_id)
			if (isAncestor) {
				return write
			} else {
				upperBound = write.message_id
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
			const [previousCSX] = await this.getLatestConflictSet(this.root, recordId)
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
			const [previousCSX] = await this.getLatestConflictSet(this.root, recordId)
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
		const result = updateModelValues(value, previousValue)
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
		const result = mergeModelValues(value, previousValue)
		await this.setModelValue(model, result, transactional)
	}

	public async getLatestConflictSet(
		root: MessageId[],
		recordId: string,
	): Promise<[csx: number | null, greatestElementId: string | null]> {
		this.log.trace("getting latest csx for record %s w/r/t root %s", recordId, root.toString())

		type Write = { record_id: string; message_id: string; csx: number | null }

		let baseId: string | null = null
		let baseCSX: number | null = null

		for await (const write of this.db.iterate<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId },
			orderBy: { "record_id/message_id": "desc" },
		})) {
			if (write.csx === null) {
				continue
			}

			const isAncestor = await this.isAncestor(root, write.message_id)
			if (!isAncestor) {
				continue
			}

			// we call the first write we encounter "baseCSX"
			baseCSX = write.csx
			baseId = write.message_id
			break
		}

		this.log.trace("got initial baseId %s and baseCSX %d", baseId, baseCSX)

		if (baseCSX === null) {
			return [null, null]
		}

		// baseCSX is *probably* the final CSX, but we still have to check
		// for other 'intermediate' messages descending from other members
		// of baseCSX that are also ancestors.

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const next = await this.getGreatestElement(root, recordId, baseCSX + 1)
			this.log.trace("checking next CS %d and got id %s", baseCSX + 1, next)
			if (next === null) {
				return [baseCSX, baseId]
			} else {
				baseCSX += 1
				baseId = next
			}
		}
	}

	public async getGreatestElement(root: MessageId[], recordId: string, csx: number): Promise<string | null> {
		assert(csx >= 0, "expected csx >= 0")

		type Write = { record_id: string; message_id: string; csx: number }

		for await (const write of this.db.iterate<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { record_id: recordId, csx },
			orderBy: { "record_id/csx/message_id": "desc" },
		})) {
			const isAncestor = await this.isAncestor(root, write.message_id)
			if (!isAncestor) {
				continue
			}

			return write.message_id
		}

		return null
	}

	public async isReverted(root: MessageId[], messageId: string): Promise<boolean> {
		this.log.trace("isReverted(%s)", messageId)
		if (messageId === MIN_MESSAGE_ID) {
			return false
		}

		const revertCauses = await this.db.query<RevertRecord>("$reverts", { where: { effect_id: messageId } })
		for (const revert of revertCauses) {
			const isAncestor = await this.isAncestor(root, revert.cause_id)
			if (isAncestor) {
				return true
			}
		}

		return false
	}
}
