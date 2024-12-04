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

export type WriteRecord = {
	key: string
	value: Uint8Array | null
	version: string | null
	reverted: boolean
}

export type ReadRecord = {
	key: string
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
			key: "primary", // `${hash(model, key)}/${version}`
			version: "string?",
			value: "bytes?",
			reverted: "boolean",
			$indexes: ["version"],
		},
		$reads: {
			key: "primary", // `${hash(model, key)}/${version}/${by}
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
			await this.db.set("$writes", { key, value, version: null, reverted: false })
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
				const keyHash = AbstractRuntime.getKeyHash(model, key)

				const effectKey = `${keyHash}/${id}`

				const effectRecord: WriteRecord = {
					key: effectKey,
					value: value && cbor.encode(value),
					version: id,
					reverted: false,
				}

				effects.push({ model: "$writes", operation: "set", value: effectRecord })

				const results = await this.db.query<{ key: string }>("$writes", {
					select: { key: true },
					where: { key: { gt: effectKey, lte: `${keyHash}/${MAX_MESSAGE_ID}` } },
					limit: 1,
				})

				if (results.length === 0) {
					if (value === null) {
						effects.push({ model, operation: "delete", key })
					} else {
						effects.push({ model, operation: "set", value })
					}
				} else {
					this.log("skipping effect %o because it is superceeded by effects %O", [key, value], results)
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

	private static getKeyHash = (model: string, key: string) => bytesToHex(blake3(`${model}/${key}`, { dkLen: 16 }))

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string,
	): Promise<null | T> {
		if (context.modelEntries[model][key] !== undefined) {
			return context.modelEntries[model][key] as T
		}

		const keyHash = AbstractRuntime.getKeyHash(model, key)
		const lowerBound = `${keyHash}/${MIN_MESSAGE_ID}`

		let upperBound = `${keyHash}/${context.id}`

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const results = await this.db.query<{ key: string; value: Uint8Array; version: string }>("$writes", {
				select: { key: true, value: true, version: true },
				where: { key: { gte: lowerBound, lt: upperBound }, reverted: false },
				orderBy: { key: "desc" },
				limit: 1,
			})

			if (results.length === 0) {
				return null
			}

			const [effect] = results

			if (effect.version === null) {
				if (effect.value === null) {
					return null
				} else {
					return cbor.decode<null | T>(effect.value)
				}
			}

			const [effectKey, messageId] = effect.key.split("/")

			const visited = new Set<string>()
			for (const parent of context.message.parents) {
				const isAncestor = await context.messageLog.isAncestor(parent, messageId, visited)
				if (isAncestor) {
					if (effect.value === null) return null
					return cbor.decode<null | T>(effect.value)
				}
			}

			upperBound = effect.key
		}
	}

	protected async setModelValue(
		context: ExecutionContext,
		model: string,
		key: string,
		value: ModelValue,
	): Promise<void> {
		validateModelValue(this.db.models[model], value)
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
