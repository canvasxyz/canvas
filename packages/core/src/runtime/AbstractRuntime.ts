import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"

import type { Action, Session, Snapshot, SignerCache } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelSchema } from "@canvas-js/modeldb"
import {
	GossipLogConsumer,
	MAX_MESSAGE_ID,
	MIN_MESSAGE_ID,
	AbstractGossipLog,
	BranchMergeRecord,
	SignedMessage,
} from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"
import { isAction, isSession, isSnapshot } from "../utils.js"

export class ExecutionContext {
	// // recordId -> { version, value }
	// public readonly reads: Record<string, { version: string | null; value: ModelValue | null }> = {}

	// // recordId -> effect
	// public readonly writes: Record<string, Effect> = {}

	public readonly modelEntries: Record<string, Record<string, ModelValue | null>>

	constructor(
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		public readonly signedMessage: SignedMessage<Action>,
		public readonly address: string,
	) {
		this.modelEntries = mapValues(messageLog.db.models, () => ({}))
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
			const { id, signature, message, branch } = signedMessage
			assert(branch !== undefined, "internal error - expected branch !== undefined")

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

		const clock = message.clock
		const branch = signedMessage.branch
		assert(branch !== undefined, "expected branch !== undefined")

		const executionContext = new ExecutionContext(messageLog, signedMessage, address)
		const result = await this.execute(executionContext)

		const actionRecord: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
		const effects: Effect[] = [{ operation: "set", model: "$actions", value: actionRecord }]

		for (const [model, entries] of Object.entries(executionContext.modelEntries)) {
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

	protected static getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

	private async getConcurrentAncestors(context: ExecutionContext, model: string, key: string) {
		const keyHash = AbstractRuntime.getKeyHash(key)
		const lowerBound = `${model}/${keyHash}/${MIN_MESSAGE_ID}`
		const upperBound = `${model}/${keyHash}/${MAX_MESSAGE_ID}`

		const result = new Set<string>()

		type Position = { branch: number; clock: number }
		const stack: Position[] = []

		const parentMessageRecords = await context.messageLog.db.getMany("$messages", context.message.parents)

		for (let i = 0; i < parentMessageRecords.length; i++) {
			const parentMessageRecord = parentMessageRecords[i]
			const parentMessageId = context.message.parents[i]
			if (parentMessageRecord == null) {
				throw new Error(`message ${parentMessageId} not found`)
			}
			stack.push({ branch: parentMessageRecord.branch, clock: parentMessageRecord.message.clock })
		}

		const visited = new Set()

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const currentMessagePosition = stack.pop()
			// no more messages to visit
			if (!currentMessagePosition) {
				break
			}
			visited.add(`${currentMessagePosition.branch}/${currentMessagePosition.clock}`)

			const effectsOnThisBranch = await this.db.query<{
				key: string
				value: Uint8Array | undefined
				branch: number
				clock: number
			}>("$effects", {
				where: {
					key: { gte: lowerBound, lt: upperBound },
					branch: currentMessagePosition.branch,
					clock: { lte: currentMessagePosition.clock },
				},
				orderBy: { clock: "desc" },
				limit: 1,
			})

			const parentPositions: Position[] = []
			const matchingEffectOnThisBranch = effectsOnThisBranch[0]
			if (matchingEffectOnThisBranch) {
				if (matchingEffectOnThisBranch.clock === currentMessagePosition.clock) {
					// the current message is the latest effect on this branch
					result.add(matchingEffectOnThisBranch.key)
					// don't explore this message's parents
					continue
				} else {
					parentPositions.push({ branch: matchingEffectOnThisBranch.branch, clock: matchingEffectOnThisBranch.clock })
				}
			}

			// check for branches that merge into this branch
			const branchMergeQuery = {
				where: {
					target_branch: currentMessagePosition.branch,
					target_clock: { lte: currentMessagePosition.clock },
				},
			}
			if (matchingEffectOnThisBranch) {
				// @ts-ignore
				branchMergeQuery.where.target_clock.gt = matchingEffectOnThisBranch.clock
			}
			for (const branchMerge of await context.messageLog.db.query<BranchMergeRecord>(
				"$branch_merges",
				branchMergeQuery,
			)) {
				parentPositions.push({
					branch: branchMerge.source_branch,
					clock: branchMerge.source_clock,
				})
			}

			for (const parentPosition of parentPositions) {
				if (!visited.has(`${parentPosition.branch}/${parentPosition.clock}`)) {
					stack.push(parentPosition)
				}
			}
		}

		// remove messages that are parents of each other
		const messagesToRemove = new Set<string>()
		for (const parentEffectId of result) {
			const parentMessageId = parentEffectId.split("/")[2]
			for (const otherEffectId of result) {
				const otherMessageId = otherEffectId.split("/")[2]
				if (parentMessageId !== otherMessageId) {
					if (await context.messageLog.isAncestor(parentMessageId, otherMessageId)) {
						messagesToRemove.add(parentMessageId)
					}
				}
			}
		}

		for (const m of messagesToRemove) {
			result.delete(m)
		}

		return Array.from(result)
	}

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string,
	): Promise<null | T> {
		if (context.modelEntries[model][key] !== undefined) {
			return context.modelEntries[model][key] as T
		}

		const keyHash = AbstractRuntime.getKeyHash(key)
		const lowerBound = `${model}/${keyHash}/`

		let upperBound = `${model}/${keyHash}/${context.id}`

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const results = await this.db.query<{ key: string; value: Uint8Array; clock: number }>("$effects", {
				select: { key: true, value: true, clock: true },
				where: { key: { gt: lowerBound, lt: upperBound } },
				orderBy: { key: "desc" },
				limit: 1,
			})

			if (results.length === 0) {
				return null
			}

			if (results[0].clock === 0) {
				if (results[0].value === null) return null
				return cbor.decode<null | T>(results[0].value)
			}

			const [effect] = results
			const [{}, {}, messageId] = effect.key.split("/")

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
}
