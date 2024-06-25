import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"
import { TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Signature, Action, Message, Session, SignerCache } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelsInit, lessThan } from "@canvas-js/modeldb"
import { GossipLogConsumer, encodeId, MAX_MESSAGE_ID, MIN_MESSAGE_ID, AbstractGossipLog } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"

export type ExecutionContext = {
	messageLog: AbstractGossipLog<Action | Session>
	id: string
	signature: Signature
	message: Message<Action>
	address: string
	modelEntries: Record<string, Record<string, ModelValue | null>>
}

export abstract class AbstractRuntime {
	protected static effectsModel: ModelsInit = {
		$effects: {
			key: "primary", // `${model}/${hash(key)}/${version}
			value: "bytes?",
			branch: "integer",
			clock: "integer",
		},
	} satisfies ModelsInit

	protected static versionsModel = {
		$versions: {
			key: "primary", // `${model}/${hash(key)}
			version: "bytes",
		},
	} satisfies ModelsInit

	protected static sessionsModel = {
		$sessions: {
			message_id: "primary",
			public_key: "string",
			address: "string",
			did: "string",
			expiration: "integer?",
			$indexes: [["address"], ["public_key"]],
		},
	} satisfies ModelsInit

	protected static getModelSchema(modelsInit: ModelsInit, options: { indexHistory: boolean }): ModelsInit {
		if (options.indexHistory) {
			return {
				...modelsInit,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			}
		} else {
			return {
				...modelsInit,
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

		const result = await this.execute({ messageLog, modelEntries, id, signature, message, address })

		const effects: Effect[] = []

		for (const [model, entries] of Object.entries(modelEntries)) {
			for (const [key, value] of Object.entries(entries)) {
				const keyHash = AbstractRuntime.getKeyHash(key)

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

					if (results.length > 0) {
						this.log("skipping effect %o because it is superceeded by effects %O", [key, value], results)
						continue
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
		const startingMessageId = context.id

		const keyHash = AbstractRuntime.getKeyHash(key)
		const lowerBound = `${model}/${keyHash}/${MIN_MESSAGE_ID}`
		const upperBound = `${model}/${keyHash}/${MAX_MESSAGE_ID}`

		const result = new Set<string>()

		const stack: string[] = []
		stack.push(startingMessageId)

		const visited = new Set()

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const currentMessageId = stack.pop()
			// no more messages to visit
			if (!currentMessageId) {
				break
			}
			visited.add(currentMessageId)

			const currentMessageEntry = await this.db.get("$messages", currentMessageId)
			if (!currentMessageEntry) {
				throw new Error(`missing message ${currentMessageId}`)
			}
			const currentMessage = currentMessageEntry.message

			if (currentMessageId != startingMessageId) {
				if (currentMessage.effects[0].key == key) {
					result.add(currentMessage.id)
					// don't explore this message's parents
					continue
				}
			}

			const parentIds: string[] = []

			const matchingEffectOnThisBranch = await this.db.query("$effects", {
				where: {
					key: { gte: lowerBound, lt: upperBound },
					branch: currentMessageEntry.branch,
					clock: { lte: currentMessageEntry.clock },
				},
				orderBy: { clock: "desc" },
				limit: 1,
			})
			if (matchingEffectOnThisBranch !== null) parentIds.push(matchingEffectOnThisBranch[0].id)

			// check for branches that merge into this branch
			for (const branchMerge of await this.db.query("$branch_merges", {
				where: {
					target_branch: currentMessageEntry.branch,
					target_clock: { lte: currentMessageEntry.clock, gt: matchingEffectOnThisBranch[0]?.clock },
				},
			})) {
				parentIds.push(branchMerge.source_message_id)
			}

			for (const parentItem of parentIds) {
				if (!visited.has(parentItem)) {
					stack.push(parentItem)
				}
			}
		}

		// remove messages that are parents of each other
		const messagesToRemove = new Set<string>()
		for (const parentMessageId of result) {
			for (const otherMessageId of result) {
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

		const keyHash = AbstractRuntime.getKeyHash(key)

		const concurrentAncestors = await this.getConcurrentAncestors(context, model, key)
		const concurrentEffects = []

		for (const ancestorId of concurrentAncestors) {
			const concurrentEffect = await this.db.get("$effects", `${model}/${keyHash}/${ancestorId}`)
			if (!concurrentEffect) {
				throw new Error(`missing concurrent effect ${model}/${keyHash}/${ancestorId}`)
			}
			concurrentEffects.push(concurrentEffect)
		}

		const mergeFunction = null

		// TODO: finish this
		//
		// default behaviour: last writer wins
		if (!mergeFunction) {
			// choose the ancestor with the highest key
			const highestKeyAncestor = concurrentEffects.reduce((a, b) => {
				return a.key > b.key ? a : b
			})
			return highestKeyAncestor.value
		}

		// if a merge function is defined, use it (i.e. for a CRDT)

		return null
	}
}
