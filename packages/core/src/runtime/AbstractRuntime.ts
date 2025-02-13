import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache, Awaitable } from "@canvas-js/interfaces"

import { Effect, ModelValue, ModelSchema, PrimaryKeyValue } from "@canvas-js/modeldb"

import { GossipLogConsumer, AbstractGossipLog, SignedMessage, MessageId, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"

import { assert } from "@canvas-js/utils"

import { ExecutionContext } from "../ExecutionContext.js"
import { getRecordId, isAction, isSession, isSnapshot } from "../utils.js"

export type WriteRecord = {
	record_id: string
	message_id: string
	value: Uint8Array | null
	csx: number | null
}

export type ReadRecord = {
	reader_id: string
	writer_id: string
	record_id: string
}

export type VersionRecord = {
	id: string
	model: string
	key: PrimaryKeyValue[]
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
	protected static effectsModel = {
		$writes: {
			$primary: "record_id/message_id",
			$indexes: ["record_id/csx/message_id", "message_id/record_id/csx"],
			record_id: "string",
			message_id: "string",
			value: "bytes?",
			csx: "integer?",
		},

		$reads: {
			$primary: "reader_id/record_id",
			reader_id: "string",
			writer_id: "string",
			record_id: "string",
		},

		$versions: { id: "primary", model: "string", key: "json", version: "string" },
	} satisfies ModelSchema

	protected static revertModel = {
		$reverts: {
			$primary: "cause_id/effect_id",
			$indexes: ["effect_id/cause_id"],
			effect_id: "string",
			cause_id: "string",
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

	protected static getModelSchema(schema: ModelSchema): ModelSchema {
		return {
			...schema,
			...AbstractRuntime.sessionsModel,
			...AbstractRuntime.actionsModel,
			...AbstractRuntime.effectsModel,
			...AbstractRuntime.revertModel,
			...AbstractRuntime.usersModel,
		}
	}

	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly schema: ModelSchema
	public abstract readonly actionNames: string[]

	protected readonly log = logger("canvas:runtime")

	protected constructor() {}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public abstract close(): Awaitable<void>

	public getConsumer(): GossipLogConsumer<Action | Session | Snapshot> {
		const handleSession = this.handleSession.bind(this)
		const handleAction = this.handleAction.bind(this)
		const handleSnapshot = this.handleSnapshot.bind(this)

		return async function (this: AbstractGossipLog<Action | Session | Snapshot>, signedMessage) {
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
				const modelValue = cbor.decode<ModelValue>(value)
				const primaryKey = model.primaryKey.map((name) => modelValue[name] as PrimaryKeyValue)
				const recordId = getRecordId(modelName, primaryKey)

				await messageLog.db.set(modelName, modelValue)

				await messageLog.db.set<WriteRecord>("$writes", {
					record_id: recordId,
					message_id: MIN_MESSAGE_ID,
					value: value,
					csx: 0,
				})

				await messageLog.db.set<VersionRecord>("$versions", {
					id: recordId,
					model: modelName,
					key: primaryKey,
					version: MIN_MESSAGE_ID,
					csx: 0,
				})
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

		const effects: Effect[] = [
			{ model: "$sessions", operation: "set", value: sessionRecord },
			{ model: "$dids", operation: "set", value: { did } },
		]

		await messageLog.db.apply(effects)
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
			throw new Error("unexpected missing signer")
		}

		const address = signer.getAddressFromDid(did)
		const executionContext = new ExecutionContext(messageLog, signedMessage, address)

		const sessions = await db.query<{ message_id: string; expiration: number | null }>("$sessions", {
			where: { public_key: signature.publicKey, did: did },
		})

		const activeSessions = sessions.filter(({ expiration }) => expiration === null || expiration > context.timestamp)

		let sessionId: string | null = null
		for (const session of activeSessions) {
			const isAncestor = await executionContext.isAncestor(executionContext.root, session.message_id)
			if (isAncestor) {
				sessionId = session.message_id
			}
		}

		if (sessionId === null) {
			throw new Error(`missing session ${signature.publicKey} for ${did}`)
		}

		const result = await this.execute(executionContext)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		const revertCauses = new Set<string>()
		const revertEffects = new Set<string>()

		for (const [recordId, { version }] of executionContext.transactionalReads) {
			if (version !== null) {
				const value: ReadRecord = { reader_id: id, writer_id: version, record_id: recordId }
				effects.push({ model: "$reads", operation: "set", value })

				for await (const revert of db.iterate<RevertRecord>("$reverts", { where: { effect_id: version } })) {
					revertCauses.add(revert.cause_id)
				}
			}
		}

		const conditionalEffects: Effect[] = []
		const effectsInCaseOfRevert: Effect[] = []

		for (const [recordId, { model, key, value, csx }] of executionContext.writes) {
			if (csx === null) {
				// LWW write
				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: id,
					value: value && cbor.encode(value),
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

				const versionValue: VersionRecord = {
					id: recordId,
					model,
					key: Array.isArray(key) ? key : [key],
					version: id,
					csx: null,
				}

				effects.push({ model: "$versions", operation: "set", value: versionValue })
			} else {
				// Transactional write

				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: id,
					value: value && cbor.encode(value),
					csx: csx,
				}

				effects.push({ model: "$writes", operation: "set", value: writeRecord })

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
						isAncestor = await executionContext.isAncestor(executionContext.root, inferiorWriteRevert.cause_id)
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

				if (superiorWrites.length > 0) {
					this.log("skipping effect %o because it is superceeded by effects %O", [model, key], superiorWrites)
					for (const write of superiorWrites) {
						revertCauses.add(write.message_id)
					}
				}

				if (superiorWrites.length === 0) {
					if (value === null) {
						conditionalEffects.push({ model, operation: "delete", key })
					} else {
						conditionalEffects.push({ model, operation: "set", value })
					}

					const versionValue: VersionRecord = {
						id: recordId,
						model: model,
						key: Array.isArray(key) ? key : [key],
						version: id,
						csx: csx,
					}

					conditionalEffects.push({ model: "$versions", operation: "set", value: versionValue })
				}
			}
		}

		const addDependencies = async (revertEffects: Set<string>, effectId: string) => {
			const dependencies = await db.query<ReadRecord>("$reads", {
				select: { reader_id: true, writer_id: true },
				where: { writer_id: effectId },
			})

			// console.log("propagating dependencies: got dependency count", effectDependencies.length)
			for (const { reader_id: dependency } of dependencies) {
				const existingCauses = await db.query<RevertRecord>("$reverts", { where: { effect_id: dependency } })
				let isAncestor = false
				for (const { cause_id: existingCause } of existingCauses) {
					isAncestor = await executionContext.isAncestor(executionContext.root, existingCause)
					if (isAncestor) {
						break
					}
				}

				if (!isAncestor) {
					this.log("adding transitive revert effect %s", dependency)
					revertEffects.add(dependency)
					await addDependencies(revertEffects, dependency)
				}
			}
		}

		this.log("got base revertEffects: %o", revertEffects)

		for (const effectId of revertEffects) await addDependencies(revertEffects, effectId)
		for (const effectId of revertEffects) {
			const value: RevertRecord = { cause_id: id, effect_id: effectId }
			effects.push({ model: "$reverts", operation: "set", value })
		}

		this.log("got base revertCauses: %o", revertCauses)

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

		this.log("got filtered revertCauses: %o", revertCauses)
		if (revertCauses.size > 0) {
			for (const causeId of revertCauses) {
				const value: RevertRecord = { effect_id: id, cause_id: causeId }
				effects.push({ model: "$reverts", operation: "set", value })
			}

			this.log("adding effects in case of revert: %o", effectsInCaseOfRevert)
			effects.push(...effectsInCaseOfRevert)
		} else {
			effects.push(...conditionalEffects)
		}

		this.log("applying effects %O", effects)

		try {
			await db.apply(effects)

			{
				const [_, heads] = await messageLog.getClock()
				const root = heads.map(MessageId.encode)

				const effects: Effect[] = []
				for (const effectId of revertEffects) {
					// check for existing versions of reverted txns
					this.log("checking for values currently referencing reverted effect %s", effectId)

					const versions = await db.query<VersionRecord>("$versions", { where: { version: effectId } })
					this.log("found %d existing records referencing the reverted action %s", versions.length, effectId)
					for (const { id, model, key } of versions) {
						const { value, csx, version } = await executionContext.getLastValueTransactional(root, id, revertEffects)

						this.log("got new version %s of record %s (csx %d)", version, id, csx)

						if (version !== null) {
							effects.push({
								model: "$versions",
								operation: "set",
								value: { id, model, key, version, csx } satisfies VersionRecord,
							})

							if (value === null) {
								effects.push({ model, operation: "delete", key })
							} else {
								effects.push({ model, operation: "set", value })
							}
						} else {
							effects.push({ model: "$versions", operation: "delete", key: id })
							effects.push({ model, operation: "delete", key })
						}
					}

					await db.apply(effects)
				}
			}
		} catch (err) {
			if (err instanceof Error) {
				err.message = `${name}: ${err.message}`
			}
			throw err
		}

		return result
	}
}
