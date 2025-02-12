import * as cbor from "@ipld/dag-cbor"

import { Action, Session, Snapshot } from "@canvas-js/interfaces"
import { ModelValue, PropertyValue, validateModelValue, updateModelValues, mergeModelValues } from "@canvas-js/modeldb"
import { AbstractGossipLog, MessageId, SignedMessage, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { getRecordId } from "./utils.js"

import { ReadRecord, WriteRecord } from "./runtime/AbstractRuntime.js"
import { logger } from "@libp2p/logger"

export class ExecutionContext {
	// recordId -> { version, value }
	public readonly transactionalReads: Map<
		string,
		{ version: string | null; value: ModelValue | null; csx: number | null }
	> = new Map()

	public readonly lwwReads: Map<string, ModelValue | null> = new Map()

	// recordId -> { model, value, csx }
	public readonly writes: Map<string, { model: string; key: string; value: ModelValue | null; csx: number | null }> =
		new Map()

	public readonly root: MessageId[]

	private readonly log = logger("canvas:runtime:exec")

	constructor(
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
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

	public async isAncestor(ancestor: string | MessageId): Promise<boolean> {
		return await this.messageLog.isAncestor(this.root, ancestor)
	}

	public async getModelValue<T extends ModelValue = ModelValue>(
		model: string,
		key: string,
		transactional: boolean,
	): Promise<T | null> {
		if (this.db.models[model] === undefined) {
			throw new Error(`model db.${model} not found`)
		}

		this.log("getModelValue(%s, %o, %o)", model, key, transactional)

		const recordId = getRecordId(model, key)

		if (this.writes.has(recordId)) {
			const { value } = this.writes.get(recordId)!
			return value as T | null
		}

		if (transactional) {
			if (this.transactionalReads.has(recordId)) {
				const { value } = this.transactionalReads.get(recordId)!
				return value as T | null
			}

			let [csx, messageId] = await this.getLatestConflictSet(recordId)
			if (csx === null || messageId === null) {
				this.transactionalReads.set(recordId, { version: null, value: null, csx: null })
				return null
			}

			this.log("got latest conflict set %d (%s)", csx, messageId)

			// this iterates backward over the greatest element of each conflict set
			// and returns the value of the first non-reverted write.
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const isReverted = await this.isReverted(messageId)
				this.log("isReverted(%s): %o", messageId, isReverted)
				if (!isReverted) {
					const write = await this.db.get<WriteRecord>("$writes", [recordId, messageId])
					assert(write !== null, "internal error - missing write record")
					const value = write.value && cbor.decode<T>(write.value)
					this.log("returning write value %o", value)
					this.transactionalReads.set(recordId, { version: messageId, value, csx })
					return value
				} else if (csx > 1) {
					csx -= 1
					messageId = await this.getGreatestElement(recordId, csx)
					assert(messageId !== null, "internal error - failed to get greatest element")
					this.log("got previous conflict set %d (%s)", csx, messageId)
				} else {
					this.transactionalReads.set(recordId, { version: null, value: null, csx: null })
					return null
				}
			}
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

	private async getLastValue(recordId: string): Promise<WriteRecord | null> {
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

			const isAncestor = await this.isAncestor(write.message_id)
			if (isAncestor) {
				return write
			} else {
				upperBound = write.message_id
			}
		}
	}

	public async setModelValue(model: string, value: ModelValue, transactional: boolean): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")

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

	public async getLatestConflictSet(recordId: string): Promise<[csx: number | null, greatestElementId: string | null]> {
		type Write = { record_id: string; message_id: string; csx: number | null }

		let baseId: string | null = null
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
			baseId = write.message_id
			break
		}

		if (baseCSX === null) {
			return [null, null]
		}

		// baseCSX is *probably* the final CSX, but we still have to check
		// for other 'intermediate' messages descending from other members
		// of baseCSX that are also ancestors.

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const next = await this.getGreatestElement(recordId, baseCSX + 1)
			if (next === null) {
				return [baseCSX, baseId]
			} else {
				baseCSX += 1
				baseId = next
			}
		}
	}

	public async getGreatestElement(recordId: string, csx: number): Promise<string | null> {
		assert(csx >= 1, "expected csx >= 1")

		type Write = { record_id: string; message_id: string; csx: number }

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

	public async isReverted(messageId: string): Promise<boolean> {
		this.log("isReverted(%s)", messageId)

		type Write = { record_id: string; message_id: string; csx: number }

		// first we check for superior elements of the message's writes
		const writes = await this.db.query<Write>("$writes", {
			select: { record_id: true, message_id: true, csx: true },
			where: { message_id: messageId, csx: { neq: null } },
		})

		this.log("got %d writes for messsage %s", writes.length, messageId)

		for (const { record_id, csx } of writes) {
			this.log("looking at conflicting writes for record %s csx %d", record_id, csx)

			for await (const write of this.db.iterate<Write>("$writes", {
				select: { record_id: true, message_id: true, csx: true },
				where: { record_id, csx, message_id: { gt: messageId } },
				orderBy: { "record_id/csx/message_id": "asc" },
			})) {
				this.log("checking if superior write from %s is an ancestor", write.message_id)
				const isAncestor = await this.isAncestor(write.message_id)
				if (isAncestor) {
					this.log("superior write to record %s from message %s is an ancestor", record_id, write.message_id)
					return true
				}
			}
		}

		// then we recursively check the message's dependencies
		const reads = await this.db.query<ReadRecord>("$reads", {
			where: { reader_id: messageId },
		})

		this.log("got %d reads for message %s", reads.length, messageId)

		for (const read of reads) {
			this.log("message %s read record %s from message %s", read.reader_id, read.record_id, read.writer_id)
			const isReverted = await this.isReverted(read.writer_id)
			if (isReverted) {
				this.log("dependency %s was reverted", read.reader_id)
				return true
			}
		}

		this.log("message %s is not reverted", messageId)
		return false
	}
}
