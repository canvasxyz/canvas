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
import { assert, mapValues } from "@canvas-js/utils"
import { isAction, isSession, isSnapshot } from "../utils.js"

export type ExecutionContext = {
	messageLog: AbstractGossipLog<Action | Session | Snapshot>
	id: string
	signature: Signature
	message: Message<Action>
	address: string
	modelEntries: Record<string, Record<string, ModelValue | null>>
	branch: number
}

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
		$dids: {
			did: "primary",
			$indexes: [["did"]],
		},
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
				return await handleAction(id, signature, message, this, { branch })
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

		const effects: Effect[] = [
			{
				model: "$sessions",
				operation: "set",
				value: {
					message_id: id,
					public_key: publicKey,
					did,
					address,
					expiration: duration === undefined ? null : timestamp + duration,
				},
			},
			{
				model: "$dids",
				operation: "set",
				value: { did },
			},
		]
		await this.db.apply(effects)
	}

	private async handleAction(
		id: string,
		signature: Signature,
		message: Message<Action>,
		messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		{ branch }: { branch: number },
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

		const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(this.db.models, () => ({}))

		const result = await this.execute({ messageLog, modelEntries, id, signature, message, address, branch })

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [model, entries] of Object.entries(modelEntries)) {
			for (const [key, value] of Object.entries(entries)) {
				const keyHash = AbstractRuntime.getKeyHash(key)

				const effectKey = `${model}/${keyHash}/${id}`
				const results = await this.db.query<{ key: string }>("$effects", {
					select: { key: true },
					where: { key: { gt: effectKey, lte: `${model}/${keyHash}/${MAX_MESSAGE_ID}` } },
					limit: 1,
				})

				effects.push({
					model: "$effects",
					operation: "set",
					value: { key: effectKey, value: value && cbor.encode(value), branch: branch, clock: message.clock },
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

	protected static getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string,
	): Promise<null | T> {
		if (context.modelEntries[model][key] !== undefined) {
			return context.modelEntries[model][key] as T
		}

		return await this.db.get(model, key)
	}

	protected async setModelValue(
		context: ExecutionContext,
		model: string,
		key: string,
		value: ModelValue,
	): Promise<void> {
		context.modelEntries[model][key] = value
	}

	protected async deleteModelValue(context: ExecutionContext, model: string, key: string): Promise<void> {
		context.modelEntries[model][key] = null
	}

	protected async updateModelValue(
		context: ExecutionContext,
		model: string,
		key: string,
		value: ModelValue,
	): Promise<void> {
		const modelValue = await this.getModelValue(context, model, key)
		if (modelValue === null) {
			throw new Error(`db.update(${model}, ${key}): attempted to update a nonexistent value`)
		}

		const mergedValue = updateModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(this.db.models[model], mergedValue)
		context.modelEntries[model][key] = mergedValue
	}

	protected async mergeModelValue(
		context: ExecutionContext,
		model: string,
		key: string,
		value: ModelValue,
	): Promise<void> {
		const modelValue = await this.getModelValue(context, model, key)
		if (modelValue === null) {
			throw new Error(`db.merge(${model}, ${key}): attempted to merge into a nonexistent value`)
		}

		const mergedValue = mergeModelValues(value as ModelValue, modelValue ?? {})
		validateModelValue(this.db.models[model], mergedValue)
		context.modelEntries[model][key] = mergedValue
	}
}
