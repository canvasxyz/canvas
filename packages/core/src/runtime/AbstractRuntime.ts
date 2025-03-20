import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache, Awaitable, MessageType } from "@canvas-js/interfaces"

import { Effect, ModelSchema, isPrimaryKey } from "@canvas-js/modeldb"

import { GossipLogConsumer, AbstractGossipLog, SignedMessage, MessageId, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"

import { assert } from "@canvas-js/utils"

import { ExecutionContext } from "../ExecutionContext.js"

import {
	decodeRecordValue,
	encodeRecordKey,
	encodeRecordValue,
	getRecordId,
	isAction,
	isSession,
	isSnapshot,
} from "../utils.js"
import { View } from "../View.js"

export type WriteRecord = {
	record_id: string
	message_id: string
	value: Uint8Array
	csx: number | null
}

export type ReadRecord = {
	reader_id: string
	writer_id: string
	record_id: string
	csx: number
}

export type RecordRecord = {
	record_id: string
	model: string
	key: string
	version: string
	csx: number | null
}

export type RevertRecord = {
	effect_id: string
	cause_id: string
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
	public static effectsModel = {
		$writes: {
			$primary: "record_id/message_id",
			$indexes: ["record_id/csx/message_id", "message_id/record_id/csx"],
			record_id: "string",
			message_id: "string",
			value: "bytes",
			csx: "integer?",
		},

		$reads: {
			$primary: "reader_id/record_id",
			$indexes: ["record_id/csx/reader_id"],
			reader_id: "string",
			writer_id: "string",
			record_id: "string",
			csx: "integer",
		},

		$reverts: {
			$primary: "cause_id/effect_id",
			$indexes: ["effect_id/cause_id"],
			effect_id: "string",
			cause_id: "string",
		},

		$records: {
			$indexes: ["model/key"],
			record_id: "primary",
			model: "string",
			key: "string",
			version: "string",
		},
	} satisfies ModelSchema

	protected static sessionsModel = {
		$sessions: {
			message_id: "primary",
			did: "string",
			public_key: "string",
			address: "string",
			expiration: "integer?",
			$indexes: ["did", "public_key"],
		},
	} satisfies ModelSchema

	protected static actionsModel = {
		$actions: {
			message_id: "primary",
			did: "string",
			name: "string",
			timestamp: "integer",
			$indexes: ["did", "name"],
		},
	} satisfies ModelSchema

	protected static usersModel = {
		$dids: { did: "primary" },
	} satisfies ModelSchema

	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly actionNames: string[]
	public readonly schema: ModelSchema

	protected readonly log = logger("canvas:runtime")

	protected constructor(public readonly models: ModelSchema) {
		this.schema = {
			...models,
			...AbstractRuntime.sessionsModel,
			...AbstractRuntime.actionsModel,
			...AbstractRuntime.effectsModel,
			...AbstractRuntime.usersModel,
		}
	}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public abstract readonly contract: string
	public abstract close(): Awaitable<void>

	public getConsumer(): GossipLogConsumer<Action | Session | Snapshot> {
		const handleSession = this.handleSession.bind(this)
		const handleAction = this.handleAction.bind(this)
		const handleSnapshot = this.handleSnapshot.bind(this)

		return async function (this: AbstractGossipLog<MessageType>, signedMessage) {
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
		signedMessage: SignedMessage<Snapshot>,
	) {
		const { models } = signedMessage.message.payload

		const messages = await messageLog.getMessages()
		assert(messages.length === 0, "snapshot must be first entry on log")

		for (const [modelName, values] of Object.entries(models)) {
			const model = messageLog.db.models[modelName]

			for (const value of values) {
				const modelValue = decodeRecordValue(messageLog.db.config, modelName, value)
				assert(modelValue !== null, "invalid snapshot - expected modelValue !== null")

				const primaryKey = model.primaryKey.map((name) => {
					const key = modelValue[name]
					assert(isPrimaryKey(key), "invalid primary key value")
					return key
				})

				const recordId = getRecordId(modelName, primaryKey)

				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: MIN_MESSAGE_ID,
					value: value,
					csx: 0,
				}

				const versionRecord: RecordRecord = {
					record_id: recordId,
					model: modelName,
					key: encodeRecordKey(messageLog.db.config, modelName, primaryKey),
					version: MIN_MESSAGE_ID,
					csx: 0,
				}

				await messageLog.db.apply([
					{ model: modelName, operation: "set", value: modelValue },
					{ model: "$writes", operation: "set", value: writeRecord },
					{ model: "$records", operation: "set", value: versionRecord },
				])
			}
		}
	}

	private async handleSession(
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		signedMessage: SignedMessage<Session>,
	) {
		const { id, signature, message } = signedMessage
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
		const db = messageLog.db

		const { id, signature, message } = signedMessage
		const { did, name, context } = message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signature.codec) && signer.match(did))

		if (!signer) {
			throw new Error(`missing signer for codec ${signature.codec} matching did ${did}`)
		}

		const view = new ExecutionContext(messageLog, signedMessage, signer)

		const sessions = await db.query<SessionRecord>("$sessions", {
			where: { did, public_key: signature.publicKey },
		})

		const activeSessions = sessions.filter(({ expiration }) => expiration === null || expiration > context.timestamp)

		let sessionId: string | null = null
		for (const session of activeSessions) {
			const isAncestor = await view.isAncestor(session.message_id)
			if (isAncestor) {
				sessionId = session.message_id
			}
		}

		if (sessionId === null) {
			throw new Error(`missing session ${signature.publicKey} for ${did}`)
		}

		const result = await this.execute(view)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		const revertCauses = new Set<string>()
		const revertEffects = new Set<string>()

		const messageId = MessageId.encode(id)

		for (const [recordId, read] of view.transactionalReads) {
			if (read !== null) {
				const [previousCSX] = await view.getLatestConflictSet(recordId)
				const csx = (previousCSX ?? 0) + 1
				const value: ReadRecord = { reader_id: id, writer_id: read.version, record_id: recordId, csx }
				effects.push({ model: "$reads", operation: "set", value })

				for await (const revert of db.iterate<RevertRecord>("$reverts", { where: { effect_id: read.version } })) {
					revertCauses.add(revert.cause_id)
				}

				if (view.writes.get(recordId)?.csx ?? 0 > 0) {
					continue
				}

				const writes = await db.query<{ record_id: string; message_id: string; csx: number }>("$writes", {
					where: { record_id: recordId, csx },
					orderBy: { "record_id/csx/message_id": "asc" },
				})

				this.log.trace("found %d concurrent writes to record %s csx %d", writes.length, recordId, csx)
				for await (const write of writes) {
					const isAncestor = await messageLog.isAncestor(write.message_id, messageId)
					this.log.trace("- write from %s (isAncestor: %s)", write.message_id, isAncestor)
					if (!isAncestor) {
						revertCauses.add(write.message_id)
					}
				}
			}
		}

		const conditionalEffects: Effect[] = []

		for (const [recordId, { model, key, value, csx }] of view.writes) {
			if (csx === null) {
				// LWW write
				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: id,
					value: encodeRecordValue(db.config, model, value),
					csx: csx,
				}

				effects.push({ model: "$writes", operation: "set", value: writeRecord })

				const superiorWrites = await db.query<{ record_id: string; message_id: string }>("$writes", {
					select: { record_id: true, message_id: true },
					where: { record_id: recordId, message_id: { gt: id } },
					limit: 1,
				})

				if (superiorWrites.length > 0) {
					const [write] = superiorWrites
					this.log("skipping effect %o because it is superceeded by message %O", [model, key], write.message_id)
					continue
				}

				if (value === null) {
					effects.push({ model, operation: "delete", key })
				} else {
					effects.push({ model, operation: "set", value })
				}

				// TODO: update primaryKey value
				const recordValue: RecordRecord = {
					record_id: recordId,
					model,
					key: encodeRecordKey(db.config, model, key),
					version: id,
					csx: null,
				}

				effects.push({ model: "$records", operation: "set", value: recordValue })
			} else {
				// Transactional write

				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: id,
					value: encodeRecordValue(db.config, model, value),
					csx: csx,
				}

				effects.push({ model: "$writes", operation: "set", value: writeRecord })

				const conflictingReads = await db.query<ReadRecord>("$reads", { where: { record_id: recordId, csx } })
				for (const read of conflictingReads) {
					const isAncestor = await view.isAncestor(read.reader_id)
					if (!isAncestor) {
						const [{ csx } = { csx: null }] = await db.query<WriteRecord>("$writes", {
							where: { record_id: recordId, message_id: read.reader_id },
						})

						if (csx === null) {
							revertEffects.add(read.reader_id)
						}
					}
				}

				const inferiorWrites = await db.query<{ record_id: string; message_id: string; csx: number }>("$writes", {
					select: { record_id: true, message_id: true, csx: true },
					where: { record_id: recordId, csx, message_id: { lt: id } },
					orderBy: { "record_id/csx/message_id": "asc" },
				})

				for (const inferiorWrite of inferiorWrites) {
					const inferiorWriteRevertCauses = await db.query<RevertRecord>("$reverts", {
						where: { effect_id: inferiorWrite.message_id },
					})

					let isAncestor = false
					for (const inferiorWriteRevert of inferiorWriteRevertCauses) {
						isAncestor = await view.isAncestor(inferiorWriteRevert.cause_id)
						if (isAncestor) {
							break
						}
					}

					if (!isAncestor) {
						revertEffects.add(inferiorWrite.message_id)
					}
				}

				const superiorWrites = await db.query<{ record_id: string; message_id: string; csx: number }>("$writes", {
					select: { record_id: true, message_id: true, csx: true },
					where: { record_id: recordId, csx, message_id: { gt: id } },
					orderBy: { "record_id/csx/message_id": "asc" },
				})

				this.log.trace("write to %s has %d superior writes", recordId, superiorWrites.length)
				if (superiorWrites.length > 0) {
					for (const write of superiorWrites) {
						this.log.trace("- adding %s to revert causes", write.message_id)
						revertCauses.add(write.message_id)
					}
				}

				if (value === null) {
					conditionalEffects.push({ model, operation: "delete", key })
				} else {
					conditionalEffects.push({ model, operation: "set", value })
				}

				const recordValue: RecordRecord = {
					record_id: recordId,
					model: model,
					key: encodeRecordKey(db.config, model, key),
					version: id,
					csx: csx,
				}

				conditionalEffects.push({ model: "$records", operation: "set", value: recordValue })
			}
		}

		const addDependencies = async (revertEffects: Set<string>, effectId: string) => {
			const dependencies = await db.query<ReadRecord>("$reads", {
				select: { reader_id: true, writer_id: true },
				where: { writer_id: effectId },
			})

			this.log.trace("found %d dependencies for effect %s", dependencies.length, effectId)
			for (const { reader_id: dependency } of dependencies) {
				const existingCauses = await db.query<RevertRecord>("$reverts", { where: { effect_id: dependency } })
				let isAncestor = false
				for (const { cause_id: existingCause } of existingCauses) {
					isAncestor = await view.isAncestor(existingCause)
					if (isAncestor) {
						break
					}
				}

				if (!isAncestor) {
					this.log.trace("adding transitive revert effect %s", dependency)
					revertEffects.add(dependency)
					await addDependencies(revertEffects, dependency)
				}
			}
		}

		this.log.trace("got base revert effects: %o", revertEffects)

		for (const effectId of revertEffects) await addDependencies(revertEffects, effectId)
		this.log.trace("got expanded revert effects: %o", revertEffects)

		for (const effectId of revertEffects) {
			const value: RevertRecord = { cause_id: id, effect_id: effectId }
			effects.push({ model: "$reverts", operation: "set", value })
		}

		this.log.trace("got base revert causes: %o", revertCauses)

		// filter revertCauses down to a minimal mutually-concurrent set
		const revertCausesSorted = Array.from(revertCauses).sort()
		for (const [i, causeId] of revertCausesSorted.entries()) {
			for (const ancestorCauseId of revertCausesSorted.slice(0, i)) {
				const isAncestor = await messageLog.isAncestor(causeId, ancestorCauseId)
				if (isAncestor) {
					revertCauses.delete(causeId)
					break
				}
			}
		}

		this.log.trace("got reduced revert causes: %o", revertCauses)

		if (revertCauses.size > 0) {
			for (const causeId of revertCauses) {
				const value: RevertRecord = { effect_id: id, cause_id: causeId }
				effects.push({ model: "$reverts", operation: "set", value })
			}
		} else {
			effects.push(...conditionalEffects)
		}

		if (revertEffects.size > 0) {
			const [_, heads] = await messageLog.getClock()
			const currentView = new View(messageLog, heads)

			for (const effectId of revertEffects) {
				this.log.trace("checking for values currently referencing reverted effect %s", effectId)

				const versions = await db.query<RecordRecord>("$records", { where: { version: effectId } })
				this.log.trace("found %d existing records referencing the reverted action %s", versions.length, effectId)
				for (const { record_id, model, key } of versions) {
					const read = await currentView.getLastValueTransactional(model, key, record_id, revertEffects)
					if (read === null) {
						this.log.trace("no other versions of record %s found", record_id)
						effects.push({ model: "$records", operation: "delete", key: record_id })
						effects.push({ model, operation: "delete", key })
					} else {
						const { value, csx, version } = read
						this.log.trace("got new version %s of record %s (csx %d)", version, record_id, csx)
						effects.push({
							model: "$records",
							operation: "set",
							value: { record_id, model, key, version, csx } satisfies RecordRecord,
						})

						if (value === null) {
							effects.push({ model, operation: "delete", key })
						} else {
							effects.push({ model, operation: "set", value })
						}
					}
				}
			}
		}

		try {
			this.log.trace("applying effects %O", effects)
			await db.apply(effects)
		} catch (err) {
			if (err instanceof Error) {
				err.message = `${name}: ${err.message}`
			}
			throw err
		}

		return result
	}
}
