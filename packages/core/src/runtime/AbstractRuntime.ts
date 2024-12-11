import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"

import type { Signature, Action, Message, Session, Snapshot, SignerCache } from "@canvas-js/interfaces"

import {
	AbstractModelDB,
	Effect,
	ModelValue,
	ModelSchema,
	mergeModelValues,
	validateModelValue,
	updateModelValues,
} from "@canvas-js/modeldb"
import {
	GossipLogConsumer,
	MAX_MESSAGE_ID,
	MIN_MESSAGE_ID,
	AbstractGossipLog,
	BranchMergeRecord,
} from "@canvas-js/gossiplog"
import { assert, mapValues, signalInvalidType } from "@canvas-js/utils"
import { getRecordId, isAction, isSession, isSnapshot } from "../utils.js"

export type ExecutionContext = {
	messageLog: AbstractGossipLog<Action | Session | Snapshot>
	id: string
	signature: Signature
	message: Message<Action>
	address: string

	// recordId -> { version }
	reads: Record<string, { version: string | null; value: ModelValue | null }>

	// recordId -> effect
	writes: Record<string, Effect>
}

export type WriteRecord = {
	/** `${recordId}:${writerMsgId}` */
	key: string

	/** a `null` version means the value came from an initial snapshot */
	version: string | null

	value: Uint8Array | null
	reverted: boolean
}

export type ReadRecord = {
	/** `${recordId}:${readerMsgId}` */
	key: string

	/** a `null` version means the value came from an initial snapshot, OR was not never set */
	version: string | null
}

export type SessionRecord = {
	message_id: string
	did: string
	public_key: string
	address: string
	expiration: number | null
}

export type ActionRecord = {
	message_id: string
	did: string
	name: string
	timestamp: number
}

export abstract class AbstractRuntime {
	protected static effectsModel: ModelSchema = {
		$writes: {
			/** `${recordId}:${writerMsgId}` */
			key: "primary",
			/** a `null` version means the value came from an initial snapshot */
			version: "string?",
			value: "bytes?",
			reverted: "boolean",
			$indexes: ["version"],
		},
		$reads: {
			/** `${recordId}:${readerMsgId}` */
			key: "primary",
			/** a `null` version means the value came from an initial snapshot, OR was not never set */
			version: "string?",
			$indexes: ["version"],
		},
		$records: {
			/**
			 * currently record ids are base64(blake3([model, key].join("/"), 18)),
			 * but we could just as well make then random bytes or auto-incrementing integers
			 */
			id: "primary",
			model: "string",
			key: "string",
		},
	} satisfies ModelSchema

	protected static sessionsModel = {
		$sessions: {
			message_id: "primary",
			did: "string",
			public_key: "string",
			address: "string",
			expiration: "integer?",
			$indexes: [["did"], ["public_key"]],
		},
	} satisfies ModelSchema

	protected static actionsModel = {
		$actions: {
			message_id: "primary",
			did: "string",
			name: "string",
			timestamp: "integer",
			$indexes: [["did"], ["name"]],
		},
	} satisfies ModelSchema

	protected static usersModel = {
		$dids: { did: "primary" },
	} satisfies ModelSchema

	protected static getModelSchema(schema: ModelSchema): ModelSchema {
		return {
			...schema,
			...AbstractRuntime.sessionsModel,
			...AbstractRuntime.actionsModel,
			...AbstractRuntime.effectsModel,
			...AbstractRuntime.usersModel,
		}
	}

	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly schema: ModelSchema
	public abstract readonly actionNames: string[]

	protected readonly log = logger("canvas:runtime")
	#db: AbstractModelDB | null = null

	protected constructor() {}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public get db() {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		return this.#db
	}

	public set db(db: AbstractModelDB) {
		this.#db = db
	}

	public async close() {
		await this.db.close()
	}

	public getConsumer(): GossipLogConsumer<Action | Session | Snapshot> {
		const handleSession = this.handleSession.bind(this)
		const handleAction = this.handleAction.bind(this)
		const handleSnapshot = this.handleSnapshot.bind(this)

		return async function (this: AbstractGossipLog<Action | Session | Snapshot>, signedMessage) {
			const { id, signature, message, branch } = signedMessage
			assert(branch !== undefined, "internal error - expected branch !== undefined")

			if (isSession(message)) {
				return await handleSession(id, signature, message)
			} else if (isAction(message)) {
				return await handleAction(id, signature, message, this)
			} else if (isSnapshot(message)) {
				return await handleSnapshot(id, signature, message, this)
			} else {
				throw new Error("invalid message payload type")
			}
		}
	}

	private async handleSnapshot(
		id: string,
		signature: Signature,
		message: Message<Snapshot>,
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
	) {
		const { models, effects } = message.payload

		const messageCount = await messageLog.db.count("$messages")
		assert(messageCount === 0, "snapshot must be first entry on log")

		for (const { model, key, value } of effects) {
			const recordId = getRecordId(model, key)
			await this.db.set("$records", { id: recordId, key, model })
			await this.db.set("$writes", {
				key: `${recordId}:${MIN_MESSAGE_ID}`,
				version: null,
				value,
				reverted: false,
			})

			// if (value !== null) {
			// 	await this.db.set(model, cbor.decode<ModelValue>(value))
			// }
		}

		for (const [model, rows] of Object.entries(models)) {
			for (const row of rows) {
				await this.db.set(model, cbor.decode(row) as any)
			}
		}
	}

	private async handleSession(id: string, signature: Signature, message: Message<Session>) {
		const {
			publicKey,
			did,
			context: { timestamp, duration },
		} = message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signature.codec) && signer.match(did))

		assert(signer !== undefined, "no matching signer found")

		assert(publicKey === signature.publicKey)

		await signer.verifySession(this.topic, message.payload)
		const address = signer.getAddressFromDid(did)

		const sessionRecord: SessionRecord = {
			message_id: id,
			public_key: publicKey,
			did,
			address,
			expiration: duration === undefined ? null : timestamp + duration,
		}

		await this.db.apply([
			{ model: "$sessions", operation: "set", value: sessionRecord },
			{ model: "$dids", operation: "set", value: { did } },
		])
	}

	private async handleAction(
		id: string,
		signature: Signature,
		message: Message<Action>,
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
	) {
		const { did, name, context } = message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signature.codec) && signer.match(did))

		if (!signer) {
			throw new Error("unexpected missing signer")
		}

		const address = signer.getAddressFromDid(did)

		const sessions = await this.db.query<{ message_id: string; expiration: number | null }>("$sessions", {
			where: { public_key: signature.publicKey, did: did },
		})

		const activeSessions = sessions.filter(({ expiration }) => expiration === null || expiration > context.timestamp)

		let sessionId: string | null = null
		for (const { message_id } of activeSessions) {
			const visited = new Set<string>()
			for (const parentId of message.parents) {
				const isAncestor = await messageLog.isAncestor(parentId, message_id, visited)
				if (isAncestor) {
					sessionId = message_id
					break
				}
			}
		}

		if (sessionId === null) {
			throw new Error(`missing session ${signature.publicKey} for ${did}`)
		}

		const writes: Record<string, Effect> = {}
		const reads: Record<string, { version: string | null; value: ModelValue | null }> = {}
		const executionContext: ExecutionContext = { messageLog, id, signature, message, address, reads, writes }
		const result = await this.execute(executionContext)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [recordId, { version }] of Object.entries(reads)) {
			const readRecord: ReadRecord = { key: `${recordId}:${id}`, version }
			effects.push({ model: "$reads", operation: "set", value: readRecord })
		}

		// Step 1a: identify write-write conflicts
		const writeConflicts = new Set<string>()
		for (const [recordId, effect] of Object.entries(writes)) {
			const [model, key, value] = this.parseEffect(effect)
			const writeRecord: WriteRecord = {
				key: `${recordId}:${id}`,
				version: id,
				value: value && cbor.encode(value),
				reverted: false,
			}

			effects.push({ model: "$writes", operation: "set", value: writeRecord })
			effects.push({ model: "$records", operation: "set", value: { id: recordId, model, key } })

			const writeConflict = await this.findWriteConflict(executionContext, recordId, { reverted: false })
			if (writeConflict !== null) {
				writeConflicts.add(writeConflict)
			}
		}

		/** These messages are superior to the current action */
		const superiorWrites: string[] = []

		/** These messages are inferior to the current action */
		const inferiorWrites: string[] = []

		for (const messageId of writeConflicts) {
			assert(messageId !== executionContext.id, "expected messageId !== executionContext.id")
			if (messageId < executionContext.id) {
				superiorWrites.push(messageId)
			} else {
				inferiorWrites.push(messageId)
			}
		}

		const revertEffects: Record<string, Effect> = {}
		const reverted = new Set<string>()

		// Step 1b: revert inferior write-write conflicts
		for (const messageId of inferiorWrites) {
			this.log("reverting inferior write conflict %s", messageId)
			await this.revert(messageId, effects, revertEffects, reverted)
		}

		// n.b. there's an open question here of whether we can safely
		// remove any superior conflicts that were descendants of
		// inferior conflicts and thus already reverted.
		// To err on the side of safety we *don't* assume this now,
		// but could prove/test for this and enable it in the future.

		// Step 2: identify read-write conflicts
		// When checking for conflicts between new reads and existing writes, we have to search over
		// *all* writes, both reverted and non-reverted.
		// Safe restrictions on this search may exist but they have not yet been identified.

		/** IDs of concurrent reads that conflict with the current action's writes */
		const inferiorReads = new Set<string>()
		for (const recordId of Object.keys(writes)) {
			const conflicts = await this.getReadConflicts(executionContext, recordId)
			for (const conflict of conflicts) {
				inferiorReads.add(conflict)
			}
		}

		/** IDs of concurrent writes that conflict with the current action's reads */
		const superiorReads = new Set<string>()
		for (const [recordId, version] of Object.entries(reads)) {
			const conflictId = await this.findWriteConflict(executionContext, recordId)
			if (conflictId !== null) {
				superiorReads.add(conflictId)
			}
		}

		// n.b. unlike writes, inferiorReads and superiorReads may have non-empty intersection

		// Step 2b: revert conflicting reads
		for (const messageId of inferiorReads) {
			this.log("reverting inferior read conflict %s", messageId)
			await this.revert(messageId, effects, revertEffects, reverted)
		}

		if (superiorWrites.length === 0 && superiorReads.size === 0) {
			for (const effect of Object.values({ ...revertEffects, ...writes })) {
				effects.push(effect)
			}
		} else {
			// still need to apply revert effects
			for (const effect of Object.values(revertEffects)) {
				effects.push(effect)
			}

			this.log("skipping action effects")
			this.log("write conflicts: %o", superiorWrites)
			this.log("read conflicts: %o", superiorReads)
		}

		this.log("applying db effects %O", effects)
		try {
			await this.db.apply(effects)
		} catch (err) {
			if (err instanceof Error) {
				err.message = `${name}: ${err.message}`
			}

			throw err
		}

		return result
	}

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string,
	): Promise<T | null> {
		const recordId = getRecordId(model, key)

		if (context.writes[recordId] !== undefined) {
			if (context.writes[recordId].operation === "set") {
				return context.writes[recordId].value as T
			} else {
				return null
			}
		}

		if (context.reads[recordId] !== undefined) {
			return context.reads[recordId].value as T
		}

		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${MAX_MESSAGE_ID}`

		const [record = null] = await this.db.query<{ key: string; version: string | null; value: Uint8Array | null }>(
			"$writes",
			{
				select: { key: true, version: true, value: true },
				orderBy: { key: "desc" },
				where: { key: { gte: minKey, lte: maxKey } },
				limit: 1,
			},
		)

		if (record === null) {
			context.reads[recordId] = { version: null, value: null }
			return null
		}

		if (record.value === null) {
			context.reads[recordId] = { version: record.version, value: null }
			return null
		} else {
			const value = cbor.decode<T>(record.value)
			assert(value !== null, "expected value !== null")
			context.reads[recordId] = { version: record.version, value }
			return value
		}
	}

	protected async setModelValue(context: ExecutionContext, model: string, value: ModelValue): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		validateModelValue(this.db.models[model], value)
		const { primaryKey } = this.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")
		const recordId = getRecordId(model, key)
		context.writes[recordId] = { operation: "set", model, value }
	}

	protected async deleteModelValue(context: ExecutionContext, model: string, key: string): Promise<void> {
		const recordId = getRecordId(model, key)
		context.writes[recordId] = { operation: "delete", model, key }
	}

	protected async updateModelValue(context: ExecutionContext, model: string, value: ModelValue): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const { primaryKey } = this.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const modelValue = await this.getModelValue(context, model, key)
		if (modelValue === null) {
			throw new Error(`db.update(${model}, ${key}): attempted to update a nonexistent value`)
		}

		const updatedValue = updateModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(this.db.models[model], updatedValue)

		const recordId = getRecordId(model, key)
		context.writes[recordId] = { operation: "set", model, value: updatedValue }
	}

	protected async mergeModelValue(context: ExecutionContext, model: string, value: ModelValue): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		const { primaryKey } = this.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const modelValue = await this.getModelValue(context, model, key)
		if (modelValue === null) {
			throw new Error(`db.merge(${model}, ${key}): attempted to merge into a nonexistent value`)
		}

		const mergedValue = mergeModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(this.db.models[model], mergedValue)

		const recordId = getRecordId(model, key)
		context.writes[recordId] = { operation: "set", model, value: mergedValue }
	}

	/** Returns set of concurrent read conflicts for the provided record ID */
	private async getReadConflicts(context: ExecutionContext, recordId: string): Promise<string[]> {
		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${MAX_MESSAGE_ID}`

		const [{ key: prevKey } = {}] = await this.db.query<{ key: string }>("$writes", {
			select: { key: true },
			orderBy: { key: "desc" },
			where: { key: { gte: minKey, lte: maxKey } },
			limit: 1,
		})

		if (prevKey === undefined) {
			return []
		}

		const [_, prevId] = prevKey.split(":")

		const conflicts: string[] = []
		for await (const { key } of this.db.iterate<{ key: string }>("$reads", {
			select: { key: true },
			orderBy: { key: "asc" },
			where: { key: { gt: prevKey, lte: maxKey } },
		})) {
			const [_, readerMsgId] = key.split(":")

			// assert that prevId is an ancestor of readId.
			// this is just for sanity checking; can remove this if everything works right
			await context.messageLog
				.isAncestor(readerMsgId, prevId)
				.then((is) => assert(is || prevId === MIN_MESSAGE_ID, "expected isAncestor(readId, prevId)"))

			const isAncestor = await this.isAncestor(context, readerMsgId)
			if (!isAncestor) {
				conflicts.push(readerMsgId)
			}
		}

		return conflicts
	}

	/** Returns the earliest concurrent write conflict for the provided record ID */
	private async findWriteConflict(
		context: ExecutionContext,
		recordId: string,
		options: { reverted?: boolean } = {},
	): Promise<null | string> {
		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${MAX_MESSAGE_ID}`

		let lastVersion: string | null = null

		for await (const { key } of this.db.iterate<{ key: string }>("$writes", {
			select: { key: true },
			orderBy: { key: "desc" },
			where: { key: { gte: minKey, lte: maxKey }, reverted: options.reverted },
		})) {
			const [_, msgId] = key.split(":")

			const isAncestor = await this.isAncestor(context, msgId)
			if (isAncestor) {
				break
			} else {
				lastVersion = msgId
			}
		}

		return lastVersion
	}

	private async revert(
		messageId: string,
		effects: Effect[],
		revertEffects: Record<string, Effect>,
		reverted = new Set<string>(),
	): Promise<void> {
		if (reverted.has(messageId)) {
			return
		} else {
			reverted.add(messageId)
		}

		// we are guaranteed a "linear version history" invariant
		const writes = await this.db.query<WriteRecord>("$writes", {
			where: { version: messageId },
		})

		for (const writeRecord of writes) {
			effects.push({
				operation: "set",
				model: "$writes",
				value: { ...writeRecord, reverted: true },
			})

			const [recordId, _] = writeRecord.key.split(":")
			const minKey = `${recordId}:${MIN_MESSAGE_ID}`

			const record = await this.db.get<{ model: string; key: string }>("$records", recordId)
			assert(record !== null, "expected record !== null", { recordId })
			const { model, key } = record

			const [prev] = await this.db.query<WriteRecord>("$writes", {
				orderBy: { key: "desc" },
				where: { key: { gte: minKey, lt: writeRecord.key }, reverted: false },
				limit: 1,
			})

			if (prev === undefined || prev.value === null) {
				revertEffects[recordId] = { operation: "delete", model, key }
			} else {
				const value = cbor.decode<ModelValue>(prev.value)
				assert(value !== null, "expected value !== null")
				revertEffects[recordId] = { operation: "set", model, value }
			}
		}

		// now revert actions that read from the reads.
		// this has potential to be a large query.
		const readers = await this.db.query<ReadRecord>("$reads", {
			where: { version: messageId },
		})

		for (const { key } of readers) {
			const [recordId, readerMsgId] = key.split(":")
			await this.revert(readerMsgId, effects, revertEffects, reverted)
		}
	}

	/**
	 * This is a utility method for finding if msgId is an ancestor of the
	 * current execution context. This loops over context.message.parents,
	 * since the action has not been committed yet so context.id doesn't
	 * exist in the database yet.
	 */
	private async isAncestor(context: ExecutionContext, msgId: string): Promise<boolean> {
		// TODO: handle this in a more elegant way
		if (msgId === MIN_MESSAGE_ID) {
			return true
		}

		const visited = new Set<string>()
		for (const parent of context.message.parents) {
			const isAncestor = await context.messageLog.isAncestor(parent, msgId, visited)
			if (isAncestor) {
				return true
			}
		}

		return false
	}

	private parseEffect(effect: Effect): [string, string, ModelValue | null] {
		if (effect.operation === "set") {
			assert(this.db.models[effect.model] !== undefined)
			const { primaryKey } = this.db.models[effect.model]
			return [effect.model, effect.value[primaryKey], effect.value]
		} else if (effect.operation === "delete") {
			return [effect.model, effect.key, null]
		} else {
			signalInvalidType(effect)
		}
	}
}
