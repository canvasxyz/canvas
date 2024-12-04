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
import { unzip } from "zlib"

export type ExecutionContext = {
	messageLog: AbstractGossipLog<Action | Session | Snapshot>
	id: string
	signature: Signature
	message: Message<Action>
	address: string

	// recordId -> version
	reads: Record<string, string>

	// recordId -> effect
	writes: Record<string, Effect>
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
		const reads: Record<string, string> = {}
		const result = await this.execute({ messageLog, id, signature, message, address, reads, writes })

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [recordId, effect] of Object.entries(writes)) {
			const effectKey = `${recordId}/${id}`

			const writeRecord: WriteRecord = {
				key: effectKey,
				value: effect.operation === "set" ? cbor.encode(effect.value) : null,
				version: id,
				reverted: false,
			}

			effects.push({ model: "$writes", operation: "set", value: writeRecord })

			const results = await this.db.query<{ key: string }>("$writes", {
				select: { key: true },
				where: { key: { gt: effectKey, lte: `${recordId}/${MAX_MESSAGE_ID}` } },
				limit: 1,
			})

			if (results.length === 0) {
				effects.push(effect)
			} else {
				this.log("skipping effect %s because it is superceeded by effects %O", effectKey, results)
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

	private static getRecordId = (model: string, key: string) => bytesToHex(blake3(`${model}/${key}`, { dkLen: 16 }))

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string,
	): Promise<null | T> {
		const recordId = AbstractRuntime.getRecordId(model, key)

		if (context.writes[recordId] !== undefined) {
			if (context.writes[recordId].operation === "set") {
				return context.writes[recordId].value as T
			} else {
				return null
			}
		}

		const lowerBound = `${recordId}/${MIN_MESSAGE_ID}`

		let upperBound = `${recordId}/${context.id}`

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

			const [recordId, messageId] = effect.key.split("/")

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

	protected async setModelValue(context: ExecutionContext, model: string, value: ModelValue): Promise<void> {
		assert(this.db.models[model] !== undefined, "model not found")
		validateModelValue(this.db.models[model], value)
		const { primaryKey } = this.db.models[model]
		const { [primaryKey]: key } = value as ModelValue
		assert(typeof key === "string", "expected value[primaryKey] to be a string")
		const recordId = AbstractRuntime.getRecordId(model, key)
		context.writes[recordId] = { operation: "set", model, value }
	}

	protected async deleteModelValue(context: ExecutionContext, model: string, key: string): Promise<void> {
		const recordId = AbstractRuntime.getRecordId(model, key)
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

		const recordId = AbstractRuntime.getRecordId(model, key)
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

		const recordId = AbstractRuntime.getRecordId(model, key)
		context.writes[recordId] = { operation: "set", model, value: mergedValue }
	}
}
