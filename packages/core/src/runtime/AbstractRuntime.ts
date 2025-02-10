import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache, Awaitable } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelSchema } from "@canvas-js/modeldb"
import { GossipLogConsumer, MAX_MESSAGE_ID, AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import { ExecutionContext, getKeyHash } from "../ExecutionContext.js"
import { isAction, isSession, isSnapshot } from "../utils.js"
import * as Y from "yjs"

export type EffectRecord = { key: string; value: Uint8Array | null; branch: number; clock: number }

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
			branch: "integer",
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
		const outputSchema: ModelSchema = {}
		for (const [modelName, modelSchema] of Object.entries(schema)) {
			// @ts-ignore
			if (modelSchema.content === "yjs-text") {
				if (
					Object.entries(modelSchema).length !== 2 &&
					// @ts-ignore
					modelSchema.id !== "primary"
				) {
					// not valid
					throw new Error("yjs-text tables must have two columns, one of which is 'id'")
				} else {
					// create the two tables
					// operations
					outputSchema[`${modelName}:operations`] = {
						$primary: "operation_id",
						operation_id: "string",
						record_id: "string",
						message_id: "string",
						operations: "json",
					}
					// state
					outputSchema[`${modelName}:state`] = {
						id: "primary",
						content: "bytes",
					}
				}
			} else {
				outputSchema[modelName] = modelSchema
			}
		}

		return {
			...outputSchema,
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

	public abstract close(): Awaitable<void>

	public get db() {
		assert(this.#db !== null, "internal error - expected this.#db !== null")
		return this.#db
	}

	public set db(db: AbstractModelDB) {
		this.#db = db
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
		const { models, effects } = signedMessage.message.payload

		const messages = await messageLog.getMessages()
		assert(messages.length === 0, "snapshot must be first entry on log")

		for (const { key, value } of effects) {
			await this.db.set("$effects", { key, value, branch: 0, clock: 0 })
		}
		for (const [model, rows] of Object.entries(models)) {
			for (const row of rows) {
				await this.db.set(model, cbor.decode(row) as any)
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

		const clock = message.clock
		const branch = signedMessage.branch
		assert(branch !== undefined, "expected branch !== undefined")

		const result = await this.execute(executionContext)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [model, entries] of Object.entries(executionContext.operations)) {
			for (const [key, operations] of Object.entries(entries)) {
				effects.push({
					model: `${model}:operations`,
					operation: "set",
					value: {
						record_id: key,
						operation_id: `${key}/${executionContext.id}`,
						message_id: executionContext.id,
						operations,
					},
				})

				// apply the operations to the state
				let ytext = await executionContext.messageLog.getYText(model, key)
				if (ytext === null) {
					const doc = new Y.Doc()
					ytext = doc.getText()
				}

				// apply the actual operations to the document
				for (const operation of operations) {
					const absolutePosition = Y.createAbsolutePositionFromRelativePosition(operation.pos, ytext.doc!)

					if (!absolutePosition) {
						// throw an error - we can't generate an absolute position from this relative position
						throw new Error(
							`Could not generate absolute position from relative position ${JSON.stringify(operation.pos)}`,
						)
					}

					if (operation.type === "yjsInsert") {
						ytext.insert(absolutePosition.index, operation.content)
					} else if (operation.type === "yjsDelete") {
						ytext.delete(absolutePosition.index, operation.length)
					} else if (operation.type === "yjsFormat") {
						ytext.format(absolutePosition.index, operation.length, operation.formattingAttributes)
					}
				}

				await this.db.set(`${model}:state`, { id: key, content: Y.encodeStateAsUpdate(ytext.doc!) })
			}
		}

		for (const [model, entries] of Object.entries(executionContext.modelEntries)) {
			for (const [key, value] of Object.entries(entries)) {
				const keyHash = getKeyHash(key)

				const effectKey = `${model}/${keyHash}/${id}`
				const results = await this.db.query<{ key: string }>("$effects", {
					select: { key: true },
					where: { key: { gt: effectKey, lte: `${model}/${keyHash}/${MAX_MESSAGE_ID}` } },
					limit: 1,
				})

				effects.push({
					model: "$effects",
					operation: "set",
					value: { key: effectKey, value: value && cbor.encode(value), branch, clock },
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
