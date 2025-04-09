import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"

import type { Action, Session, Snapshot, SignerCache, Awaitable, MessageType } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelSchema } from "@canvas-js/modeldb"
import { GossipLogConsumer, MAX_MESSAGE_ID, AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { ExecutionContext, getKeyHash } from "../ExecutionContext.js"
import { isAction, isSession, isSnapshot } from "../utils.js"
import { Contract } from "../types.js"
import { hashSnapshot } from "../snapshot.js"

export type EffectRecord = { key: string; value: Uint8Array | null; clock: number }

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
		$effects: {
			key: "primary", // `${model}/${hash(key)}/${version}
			value: "bytes?",
			clock: "integer",
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
			...AbstractRuntime.usersModel,
		}
	}

	public readonly schema: ModelSchema
	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly actionNames: string[]
	public abstract readonly contract: string | Contract<any, any>

	protected readonly log = logger("canvas:runtime")
	#db: AbstractModelDB | null = null

	protected constructor(public readonly models: ModelSchema) {
		this.schema = AbstractRuntime.getModelSchema(models)
	}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public abstract close(): Awaitable<void>

	public get db() {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		return this.#db
	}

	public set db(db: AbstractModelDB) {
		this.#db = db
	}

	public getConsumer(): GossipLogConsumer<MessageType> {
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

	private async handleSnapshot(messageLog: AbstractGossipLog<MessageType>, signedMessage: SignedMessage<Snapshot>) {
		const { models, effects } = signedMessage.message.payload

		assert(signedMessage.message.clock === 0, "snapshot must have clock === 0")
		for (const { key, value } of effects) {
			await messageLog.db.set("$effects", { key, value, clock: 0 })
		}

		for (const [model, rows] of Object.entries(models)) {
			for (const row of rows) {
				await messageLog.db.set(model, cbor.decode(row) as any)
			}
		}
	}

	private async handleSession(messageLog: AbstractGossipLog<MessageType>, signedMessage: SignedMessage<Session>) {
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

	private async handleAction(messageLog: AbstractGossipLog<MessageType>, signedMessage: SignedMessage<Action>) {
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

		const sessions = await messageLog.db.query<{ message_id: string; expiration: number | null }>("$sessions", {
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

		const clock = message.clock
		const result = await this.execute(executionContext)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [model, entries] of Object.entries(executionContext.modelEntries)) {
			for (const [key, value] of Object.entries(entries)) {
				const keyHash = getKeyHash(key)

				const effectKey = `${model}/${keyHash}/${id}`
				const results = await messageLog.db.query<{ key: string }>("$effects", {
					select: { key: true },
					where: { key: { gt: effectKey, lte: `${model}/${keyHash}/${MAX_MESSAGE_ID}` } },
					limit: 1,
				})

				effects.push({
					model: "$effects",
					operation: "set",
					value: { key: effectKey, value: value && cbor.encode(value), clock },
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
			await messageLog.db.apply(effects)
		} catch (err) {
			if (err instanceof Error) {
				err.message = `${name}: ${err.message}`
			}
			throw err
		}

		return result
	}
}
