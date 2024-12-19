import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache } from "@canvas-js/interfaces"

import {
	AbstractModelDB,
	Effect,
	ModelValue,
	ModelSchema,
	mergeModelValues,
	validateModelValue,
	updateModelValues,
	Model,
	parseConfig,
} from "@canvas-js/modeldb"

import {
	GossipLogConsumer,
	MAX_MESSAGE_ID,
	MIN_MESSAGE_ID,
	AbstractGossipLog,
	SignedMessage,
} from "@canvas-js/gossiplog"

import { assert, signalInvalidType } from "@canvas-js/utils"
import { getRecordId, isAction, isSession, isSnapshot } from "../utils.js"

export class Transaction {
	// recordId -> { version }
	public readonly reads: Record<string, { version: string | null; value: ModelValue | null }> = {}

	// recordId -> effect
	public readonly writes: Record<string, Effect> = {}

	constructor(
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly address: string,
	) {}

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
			/**
			 * `version` duplicates writerMsgId, the last component of the write key.
			 * write records initialized from a snapshot have a null version but use
			 * MIN_MESSAGE_ID for writerMsgId in the key.
			 */
			version: "string?",
			value: "bytes?",
			reverted: "boolean",
			$indexes: ["version"],
		},
		$reads: {
			/** `${recordId}:${readerMsgId}` */
			key: "primary",
			/** a `null` version means the value came from an initial snapshot, OR was never set */
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

	protected static schemaModel = {
		$models: { name: "primary", model: "json" },
	} satisfies ModelSchema

	protected static getModelSchema(schema: ModelSchema): ModelSchema {
		return {
			...schema,
			...AbstractRuntime.sessionsModel,
			...AbstractRuntime.actionsModel,
			...AbstractRuntime.effectsModel,
			...AbstractRuntime.usersModel,
			...AbstractRuntime.schemaModel,
		}
	}

	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly actionNames: string[]

	public readonly models: Model[]
	public readonly schema: ModelSchema

	protected readonly log = logger("canvas:runtime")
	#db: AbstractModelDB | null = null

	protected constructor(modelSchema: ModelSchema) {
		const { models } = parseConfig(modelSchema)
		this.models = models
		this.schema = AbstractRuntime.getModelSchema(modelSchema)
	}

	protected abstract execute(txn: Transaction): Promise<void | any>

	public abstract close(): void

	public getConsumer(): GossipLogConsumer<Action | Session | Snapshot> {
		const handleSession = this.handleSession.bind(this)
		const handleAction = this.handleAction.bind(this)
		const handleSnapshot = this.handleSnapshot.bind(this)

		return async function (this: AbstractGossipLog<Action | Session | Snapshot>, signedMessage) {
			assert(signedMessage.branch !== undefined, "internal error - expected signedMessage.branch !== undefined")

			if (isSession(signedMessage)) {
				return await handleSession(this, signedMessage)
			} else if (isAction(signedMessage)) {
				return await handleAction(this, signedMessage)
			} else if (isSnapshot(signedMessage)) {
				return await handleSnapshot(this, signedMessage)
			} else {
				throw new Error("invalid message payload type")
			}
		}
	}

	private async handleSnapshot(
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		{ message }: SignedMessage<Snapshot>,
	) {
		const { models, effects } = message.payload

		const messageCount = await messageLog.db.count("$messages")
		assert(messageCount === 0, "snapshot must be first entry on log")

		for (const { model, key, value } of effects) {
			const recordId = getRecordId(model, key)
			await messageLog.db.set("$records", { id: recordId, key, model })
			await messageLog.db.set("$writes", {
				key: `${recordId}:${MIN_MESSAGE_ID}`,
				version: null,
				value,
				reverted: false,
			})

			if (value !== null) {
				await messageLog.db.set(model, cbor.decode<ModelValue>(value))
			}
		}
	}

	private async handleSession(
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		{ id, signature, message }: SignedMessage<Session>,
	) {
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

		await messageLog.db.apply([
			{ model: "$sessions", operation: "set", value: sessionRecord },
			{ model: "$dids", operation: "set", value: { did } },
		])
	}

	private async handleAction(
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		signedMessage: SignedMessage<Action>,
	) {
		const { did, name, context } = signedMessage.message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signedMessage.signature.codec) && signer.match(did))

		if (!signer) {
			throw new Error("unexpected missing signer")
		}

		const address = signer.getAddressFromDid(did)

		const sessions = await messageLog.db.query<SessionRecord>("$sessions", {
			where: { public_key: signedMessage.signature.publicKey, did: did },
		})

		const activeSessions = sessions.filter(({ expiration }) => expiration === null || expiration > context.timestamp)

		let sessionId: string | null = null
		for (const { message_id } of activeSessions) {
			const visited = new Set<string>()
			for (const parentId of signedMessage.message.parents) {
				const isAncestor = await messageLog.isAncestor(parentId, message_id, visited)
				if (isAncestor) {
					sessionId = message_id
					break
				}
			}
		}

		if (sessionId === null) {
			throw new Error(`missing session ${signedMessage.signature.publicKey} for ${did}`)
		}

		const txn = new Transaction(messageLog, signedMessage, address)
		const result = await this.execute(txn)

		const actionRecord: ActionRecord = { message_id: signedMessage.id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [recordId, { version }] of Object.entries(txn.reads)) {
			const readRecord: ReadRecord = { key: `${recordId}:${signedMessage.id}`, version }
			effects.push({ model: "$reads", operation: "set", value: readRecord })
		}

		// Step 1a: identify write-write conflicts
		const writeConflicts = new Set<string>()
		for (const [recordId, effect] of Object.entries(txn.writes)) {
			const [model, key, value] = this.parseEffect(txn, effect)
			const writeRecord: WriteRecord = {
				key: `${recordId}:${signedMessage.id}`,
				version: signedMessage.id,
				value: value && cbor.encode(value),
				reverted: false,
			}

			effects.push({ model: "$writes", operation: "set", value: writeRecord })
			effects.push({ model: "$records", operation: "set", value: { id: recordId, model, key } })

			const writeConflict = await this.findWriteConflict(txn, recordId, { reverted: false })
			if (writeConflict !== null) {
				writeConflicts.add(writeConflict)
			}
		}

		/** These messages are superior to the current action */
		const superiorWrites: string[] = []

		/** These messages are inferior to the current action */
		const inferiorWrites: string[] = []

		for (const messageId of writeConflicts) {
			assert(messageId !== signedMessage.id, "expected messageId !== signedMessage.id")
			if (messageId < signedMessage.id) {
				superiorWrites.push(messageId)
			} else {
				inferiorWrites.push(messageId)
			}
		}

		this.log("superior writes: %o", superiorWrites)
		this.log("inferior writes: %o", inferiorWrites)

		const revertEffects: Record<string, Effect> = {}
		const reverted = new Set<string>()

		// Step 1b: revert inferior write-write conflicts
		for (const messageId of inferiorWrites) {
			this.log("reverting inferior write conflict %s", messageId)
			await this.revert(txn, messageId, effects, revertEffects, reverted)
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
		for (const recordId of Object.keys(txn.writes)) {
			const conflicts = await this.getReadConflicts(txn, recordId)
			for (const conflict of conflicts) {
				inferiorReads.add(conflict)
			}
		}

		/** IDs of concurrent writes that conflict with the current action's reads */
		const superiorReads = new Set<string>()
		for (const [recordId, version] of Object.entries(txn.reads)) {
			const conflictId = await this.findWriteConflict(txn, recordId)
			if (conflictId !== null) {
				superiorReads.add(conflictId)
			}
		}

		// n.b. unlike writes, inferiorReads and superiorReads may have non-empty intersection

		// Step 2b: revert conflicting reads
		for (const messageId of inferiorReads) {
			this.log("reverting inferior read conflict %s", messageId)
			await this.revert(txn, messageId, effects, revertEffects, reverted)
		}

		this.log("got revertEffects: %O", revertEffects)

		if (superiorWrites.length === 0 && superiorReads.size === 0) {
			for (const effect of Object.values({ ...revertEffects, ...txn.writes })) {
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

		this.log.trace("applying db effects %O", effects)
		try {
			await messageLog.db.apply(effects)
		} catch (err) {
			if (err instanceof Error) {
				err.message = `${name}: ${err.message}`
			}

			throw err
		}

		return result
	}

	protected async getModelValue<T extends ModelValue = ModelValue>(
		txn: Transaction,
		model: string,
		key: string,
	): Promise<T | null> {
		const recordId = getRecordId(model, key)

		if (txn.writes[recordId] !== undefined) {
			if (txn.writes[recordId].operation === "set") {
				return txn.writes[recordId].value as T
			} else {
				return null
			}
		}

		if (txn.reads[recordId] !== undefined) {
			return txn.reads[recordId].value as T
		}

		const record = await this.getLatestAncestorWrite(txn, recordId)

		if (record === null) {
			txn.reads[recordId] = { version: null, value: null }
			return null
		}

		if (record.value === null) {
			txn.reads[recordId] = { version: record.version, value: null }
			return null
		} else {
			const value = cbor.decode<T>(record.value)
			assert(value !== null, "expected value !== null")
			txn.reads[recordId] = { version: record.version, value }
			return value
		}
	}

	private async getLatestAncestorWrite(txn: Transaction, recordId: string): Promise<WriteRecord | null> {
		// TODO: what we really need is to find a min-ID winner of the most recent set of mutually concurrent
		// writes *WITHIN* the transitive ancestor set of the current transaction.
		// this is actually a new kind of search that we havne't done before.

		// for now we just find the max-ID ancestor write which is deterministic but not quite correct.

		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${txn.id}`

		for await (const record of txn.db.iterate<WriteRecord>("$writes", {
			orderBy: { key: "desc" },
			where: { key: { gte: minKey, lt: maxKey } },
		})) {
			const [_, writerMsgId] = record.key.split(":")
			const isAncestor = await this.isAncestor(txn, writerMsgId)
			if (isAncestor) {
				return record
			}
		}

		return null
	}

	protected async setModelValue(txn: Transaction, model: string, value: ModelValue): Promise<void> {
		assert(txn.db.models[model] !== undefined, "model not found")
		validateModelValue(txn.db.models[model], value)
		const { primaryKey } = txn.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")
		const recordId = getRecordId(model, key)
		txn.writes[recordId] = { operation: "set", model, value }
	}

	protected async deleteModelValue(txn: Transaction, model: string, key: string): Promise<void> {
		const recordId = getRecordId(model, key)
		txn.writes[recordId] = { operation: "delete", model, key }
	}

	protected async updateModelValue(txn: Transaction, model: string, value: ModelValue): Promise<void> {
		assert(txn.db.models[model] !== undefined, "model not found")
		const { primaryKey } = txn.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const modelValue = await this.getModelValue(txn, model, key)
		if (modelValue === null) {
			throw new Error(`db.update(${model}, ${key}): attempted to update a nonexistent value`)
		}

		const updatedValue = updateModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(txn.db.models[model], updatedValue)

		const recordId = getRecordId(model, key)
		txn.writes[recordId] = { operation: "set", model, value: updatedValue }
	}

	protected async mergeModelValue(txn: Transaction, model: string, value: ModelValue): Promise<void> {
		assert(txn.db.models[model] !== undefined, "model not found")
		const { primaryKey } = txn.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")

		const modelValue = await this.getModelValue(txn, model, key)
		if (modelValue === null) {
			throw new Error(`db.merge(${model}, ${key}): attempted to merge into a nonexistent value`)
		}

		const mergedValue = mergeModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(txn.db.models[model], mergedValue)

		const recordId = getRecordId(model, key)
		txn.writes[recordId] = { operation: "set", model, value: mergedValue }
	}

	/** Returns set of concurrent read conflicts for the provided record ID */
	private async getReadConflicts(txn: Transaction, recordId: string): Promise<string[]> {
		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${MAX_MESSAGE_ID}`

		const [{ key: prevKey } = {}] = await txn.db.query<{ key: string }>("$writes", {
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
		for await (const { key } of txn.db.iterate<{ key: string }>("$reads", {
			select: { key: true },
			orderBy: { key: "asc" },
			where: { key: { gt: prevKey, lte: maxKey } },
		})) {
			const [_, readerMsgId] = key.split(":")

			// assert that prevId is an ancestor of readId.
			// this is just for sanity checking; can remove this if everything works right
			await txn.messageLog
				.isAncestor(readerMsgId, prevId)
				.then((is) => assert(is || prevId === MIN_MESSAGE_ID, "expected isAncestor(readId, prevId)"))

			const isAncestor = await this.isAncestor(txn, readerMsgId)
			if (!isAncestor) {
				conflicts.push(readerMsgId)
			}
		}

		return conflicts
	}

	/** Returns the earliest concurrent write conflict for the provided record ID */
	private async findWriteConflict(
		txn: Transaction,
		recordId: string,
		options: { reverted?: boolean } = {},
	): Promise<null | string> {
		const minKey = `${recordId}:${MIN_MESSAGE_ID}`
		const maxKey = `${recordId}:${MAX_MESSAGE_ID}`

		let lastVersion: string | null = null

		for await (const { key } of txn.db.iterate<{ key: string }>("$writes", {
			select: { key: true },
			orderBy: { key: "desc" },
			where: { key: { gte: minKey, lte: maxKey }, reverted: options.reverted },
		})) {
			const [_, msgId] = key.split(":")

			const isAncestor = await this.isAncestor(txn, msgId)
			if (isAncestor) {
				break
			} else {
				lastVersion = msgId
			}
		}

		return lastVersion
	}

	private async revert(
		txn: Transaction,
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

		this.log("revert(%s)", messageId)

		// we are guaranteed a "linear version history" invariant
		const writes = await txn.db.query<WriteRecord>("$writes", {
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

			const record = await txn.db.get<{ model: string; key: string }>("$records", recordId)
			assert(record !== null, "expected record !== null", { recordId })
			const { model, key } = record

			const [prev] = await txn.db.query<WriteRecord>("$writes", {
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
		const readers = await txn.db.query<ReadRecord>("$reads", {
			where: { version: messageId },
		})

		for (const { key } of readers) {
			const [recordId, readerMsgId] = key.split(":")
			await this.revert(txn, readerMsgId, effects, revertEffects, reverted)
		}
	}

	/**
	 * This is a utility method for finding if msgId is an ancestor of the
	 * current transaction. This loops over txn.message.parents,
	 * since the action has not been committed yet so txn.id doesn't
	 * exist in the database yet.
	 */
	private async isAncestor(txn: Transaction, msgId: string): Promise<boolean> {
		// TODO: handle this in a more elegant way
		if (msgId === MIN_MESSAGE_ID) {
			return true
		}

		const visited = new Set<string>()
		for (const parent of txn.message.parents) {
			const isAncestor = await txn.messageLog.isAncestor(parent, msgId, visited)
			if (isAncestor) {
				return true
			}
		}

		return false
	}

	private parseEffect(txn: Transaction, effect: Effect): [string, string, ModelValue | null] {
		if (effect.operation === "set") {
			assert(txn.db.models[effect.model] !== undefined)
			const { primaryKey } = txn.db.models[effect.model]
			return [effect.model, effect.value[primaryKey], effect.value]
		} else if (effect.operation === "delete") {
			return [effect.model, effect.key, null]
		} else {
			signalInvalidType(effect)
		}
	}
}
