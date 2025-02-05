import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelSchema, PrimaryKeyValue } from "@canvas-js/modeldb"
import {
	GossipLogConsumer,
	MAX_MESSAGE_ID,
	MIN_MESSAGE_ID,
	AbstractGossipLog,
	SignedMessage,
	MessageId,
} from "@canvas-js/gossiplog"

import { assert, mapValues } from "@canvas-js/utils"
import { getRecordId, isAction, isSession, isSnapshot } from "../utils.js"

const getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

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

	public async getModelValue<T extends ModelValue = ModelValue>(model: string, key: string): Promise<null | T> {
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
}

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
			record_id: "string",
			message_id: "string",
			value: "bytes?",
			csx: "integer?",
		},

		$reads: {
			$primary: "reader_id/writer_id/record_id",
			reader_id: "string",
			writer_id: "string",
			record_id: "string",
		},

		// $records: { id: "primary", model: "string", key: "bytes" },
	} satisfies ModelSchema

	// protected static revertModel = {
	// 	$revert_slices: {
	// 		$primary: "effect_id/cause_id",
	// 		cause_id: "string",
	// 		effect_id: "primary",
	// 	},
	// } satisfies ModelSchema

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
			if (isSession(signedMessage)) {
				return await handleSession(signedMessage)
			} else if (isAction(signedMessage)) {
				return await handleAction(signedMessage, this)
			} else if (isSnapshot(signedMessage)) {
				return await handleSnapshot(signedMessage, this)
			} else {
				throw new Error("invalid message payload type")
			}
		}
	}

	private async handleSnapshot(
		signedMessage: SignedMessage<Snapshot>,
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
	) {
		const { models } = signedMessage.message.payload

		const messages = await messageLog.getMessages()
		assert(messages.length === 0, "snapshot must be first entry on log")

		for (const [modelName, values] of Object.entries(models)) {
			const model = this.db.models[modelName]

			for (const value of values) {
				const modelValue = cbor.decode<ModelValue>(value)
				const primaryKey = model.primaryKey.map((name) => modelValue[name] as PrimaryKeyValue)
				const recordId = getRecordId(modelName, primaryKey)

				await this.db.set(modelName, modelValue)

				await this.db.set<WriteRecord>("$writes", {
					record_id: recordId,
					message_id: MIN_MESSAGE_ID,
					value: value,
					csx: null,
				})
			}
		}
	}

	private async handleSession(signedMessage: SignedMessage<Session>) {
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

		await this.db.apply(effects)
	}

	private async handleAction(
		signedMessage: SignedMessage<Action>,
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
	) {
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

		const sessions = await this.db.query<{ message_id: string; expiration: number | null }>("$sessions", {
			where: { public_key: signature.publicKey, did: did },
		})

		const activeSessions = sessions.filter(({ expiration }) => expiration === null || expiration > context.timestamp)

		let sessionId: string | null = null
		for (const session of activeSessions) {
			const isAncestor = await executionContext.isAncestor(session.message_id)
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

		for (const [model, entries] of Object.entries(executionContext.modelEntries)) {
			for (const [key, value] of Object.entries(entries)) {
				const recordId = getRecordId(model, key)

				const writeRecord: WriteRecord = {
					record_id: recordId,
					message_id: id,
					value: value && cbor.encode(value),
					csx: null,
				}

				effects.push({ model: "$writes", operation: "set", value: writeRecord })

				const results = await this.db.query<{ record_id: string; message_id: string }>("$writes", {
					select: { record_id: true, message_id: true },
					where: {
						record_id: recordId,
						message_id: { gt: id, lte: MAX_MESSAGE_ID },
						csx: null,
					},
					limit: 1,
				})

				if (results.length > 0) {
					this.log("skipping effect %o because it is superceeded by effects %O", [key, value], results)
					continue
				}

				if (value === null) {
					effects.push({ model, operation: "delete", key })
				} else {
					effects.push({ model, operation: "set", value })
				}
			}
		}

		this.log("applying effects %O", effects)

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
}
