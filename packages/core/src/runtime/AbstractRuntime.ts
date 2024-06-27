import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"
import { TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Signature, Action, Message, Session, SignerCache } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelSchema, lessThan } from "@canvas-js/modeldb"
import { GossipLogConsumer, encodeId, MAX_MESSAGE_ID, MIN_MESSAGE_ID, AbstractGossipLog } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"
import { BranchMergeRecord } from "../../../gossiplog/src/BranchMergeIndex.js"

export type ExecutionContext = {
	messageLog: AbstractGossipLog<Action | Session>
	id: string
	signature: Signature
	message: Message<Action>
	address: string
	modelEntries: Record<string, Record<string, ModelValue | null>>
	branch: number
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

	protected static versionsModel = {
		$versions: {
			key: "primary", // `${model}/${hash(key)}
			version: "bytes",
		},
	} satisfies ModelSchema

	protected static sessionsModel = {
		$sessions: {
			message_id: "primary",
			public_key: "string",
			address: "string",
			did: "string",
			expiration: "integer?",
			$indexes: [["address"], ["public_key"]],
		},
	} satisfies ModelSchema

	protected static getModelSchema(modelSchema: ModelSchema, options: { indexHistory: boolean }): ModelSchema {
		if (options.indexHistory) {
			return {
				...modelSchema,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			}
		} else {
			return {
				...modelSchema,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			}
		}
	}

	public abstract readonly topic: string
	public abstract readonly signers: SignerCache
	public abstract readonly db: AbstractModelDB
	public abstract readonly actionNames: string[]
	public abstract readonly argsTransformers: Record<
		string,
		{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
	>

	protected readonly log = logger("canvas:runtime")
	protected constructor(public readonly indexHistory: boolean) {}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public async close() {
		await this.db.close()
	}

	private static isAction = (message: Message<Action | Session>): message is Message<Action> =>
		message.payload.type === "action"

	private static isSession = (message: Message<Action | Session>): message is Message<Session> =>
		message.payload.type === "session"

	public getConsumer(): GossipLogConsumer<Action | Session> {
		const handleSession = this.handleSession.bind(this)
		const handleAction = this.handleAction.bind(this)

		return async function (this: AbstractGossipLog<Action | Session>, { id, signature, message }, branch) {
			if (AbstractRuntime.isSession(message)) {
				await handleSession(id, signature, message)
			} else if (AbstractRuntime.isAction(message)) {
				await handleAction(id, signature, message, this, branch)
			} else {
				throw new Error("invalid message payload type")
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

		await this.db.set("$sessions", {
			message_id: id,
			public_key: publicKey,
			did: did,
			address: address,
			expiration: duration === undefined ? null : timestamp + duration,
		})
	}

	private async handleAction(
		id: string,
		signature: Signature,
		message: Message<Action>,
		messageLog: AbstractGossipLog<Action | Session>,
		branch: number,
	) {
		const { did, context } = message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signature.codec) && signer.match(did))

		if (!signer) {
			throw new Error("unexpected missing signer")
		}

		const address = signer.getAddressFromDid(did)

		const sessions = await this.db.query<{ id: string; expiration: number | null }>("$sessions", {
			where: { public_key: signature.publicKey, did: did },
		})

		if (sessions.every(({ expiration }) => expiration !== null && expiration < context.timestamp)) {
			throw new Error(`missing session ${signature.publicKey} for ${did}`)
		}

		const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(this.db.models, () => ({}))

		const result = await this.execute({ messageLog, modelEntries, id, signature, message, address, branch })

		const effects: Effect[] = []

		for (const [model, entries] of Object.entries(modelEntries)) {
			for (const [key, value_] of Object.entries(entries)) {
				const keyHash = AbstractRuntime.getKeyHash(key)
				let value = value_

				const mergeFunction = this.db.models[model].merge

				if (this.indexHistory) {
					const effectKey = `${model}/${keyHash}/${id}`
					const results = await this.db.query("$effects", {
						select: { key: true },
						where: { key: { gt: effectKey, lte: `${model}/${keyHash}/${MAX_MESSAGE_ID}` } },
						limit: 1,
					})

					effects.push({
						model: "$effects",
						operation: "set",
						value: { key: effectKey, value: value && cbor.encode(value), branch: branch, clock: message.clock },
					})

					if (mergeFunction) {
						const existingValue = await this.db.get(model, key)
						if (existingValue !== null) {
							value = mergeFunction(existingValue, value)
						}
					} else {
						if (results.length > 0) {
							this.log("skipping effect %o because it is superceeded by effects %O", [key, value], results)
							continue
						}
					}
				} else {
					const versionKey = `${model}/${keyHash}`
					const existingVersionRecord = await this.db.get("$versions", versionKey)
					const { version: existingVersion } = existingVersionRecord ?? { version: null }

					assert(
						existingVersion === null || existingVersion instanceof Uint8Array,
						"expected version === null || version instanceof Uint8Array",
					)

					const currentVersion = encodeId(id)
					if (existingVersion !== null && lessThan(currentVersion, existingVersion)) {
						continue
					}

					effects.push({
						model: "$versions",
						operation: "set",
						value: { key: versionKey, version: currentVersion },
					})
				}

				if (value === null) {
					effects.push({ model, operation: "delete", key })
				} else {
					effects.push({ model, operation: "set", value })
				}
			}
		}

		this.log("applying effects %O", effects)
		if (effects.length > 0) {
			await this.db.apply(effects)
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

		for (const parentMessageId of context.message.parents) {
			const parentMessageRecord = await context.messageLog.db.get("$messages", parentMessageId)
			if (!parentMessageRecord) {
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
				if (matchingEffectOnThisBranch.clock == currentMessagePosition.clock) {
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
		if (!this.indexHistory) {
			throw new Error("cannot call .get if indexHistory is disabled")
		}

		if (context.modelEntries[model][key] !== undefined) {
			return context.modelEntries[model][key] as T
		}

		const concurrentAncestors = await this.getConcurrentAncestors(context, model, key)
		const concurrentEffects = []

		for (const ancestorKey of concurrentAncestors) {
			const concurrentEffect = await this.db.get("$effects", ancestorKey)
			if (!concurrentEffect) {
				throw new Error(`missing concurrent effect ${ancestorKey}`)
			}
			concurrentEffects.push(concurrentEffect)
		}

		const mergeFunction = this.db.models[model].merge

		if (mergeFunction) {
			// if a merge function is defined, use it (i.e. for a CRDT)
			const values = concurrentEffects.map((e) => e.value as T)
			const decodedValues = values.map((v: any) => cbor.decode(v))
			return decodedValues.reduce((a, b) => mergeFunction(a, b)) as T
		} else {
			// default behaviour: last writer wins
			// choose the ancestor with the highest key
			const highestKeyAncestor = concurrentEffects.reduce((a, b) => {
				return a.key > b.key ? a : b
			})
			return cbor.decode(highestKeyAncestor.value)
		}
	}
}
