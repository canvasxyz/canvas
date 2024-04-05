import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"
import { TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Signature, Action, Message, Session, SignerCache } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelsInit, lessThan } from "@canvas-js/modeldb"
import { GossipLogConsumer, ReadOnlyTransaction, encodeId, MAX_MESSAGE_ID, MIN_MESSAGE_ID } from "@canvas-js/gossiplog"
import { assert, mapValues } from "@canvas-js/utils"

export type ExecutionContext = {
	txn: ReadOnlyTransaction
	id: string
	signature: Signature
	message: Message<Action>
	modelEntries: Record<string, Record<string, ModelValue | null>>
}

export abstract class AbstractRuntime {
	protected static effectsModel: ModelsInit = {
		$effects: {
			key: "primary", // `${model}/${hash(key)}/${version}
			value: "bytes?",
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
			expiration: "integer?",
			rawMessage: "string",
			rawSignature: "string",
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
	protected constructor(public readonly indexHistory: boolean, public readonly ignoreMissingActions: boolean) {}

	protected abstract execute(context: ExecutionContext): Promise<void | any>

	public async close() {
		await this.db.close()
	}

	private static isAction = (message: Message<Action | Session>): message is Message<Action> =>
		message.payload.type === "action"

	private static isSession = (message: Message<Action | Session>): message is Message<Session> =>
		message.payload.type === "session"

	public getConsumer(): GossipLogConsumer<Action | Session, void | any> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const runtime = this

		return async function (this: ReadOnlyTransaction, id, signature, message) {
			assert(signature !== null, "missing message signature")

			if (AbstractRuntime.isSession(message)) {
				const { publicKey, address, timestamp, duration } = message.payload

				const signer = runtime.signers
					.getAll()
					.find((signer) => signer.codecs.includes(signature.codec) && signer.match(address))

				assert(signer !== undefined, "no matching signer found")

				assert(publicKey === signature.publicKey)

				await signer.verifySession(runtime.topic, message.payload)

				await runtime.db.set("$sessions", {
					message_id: id,
					public_key: publicKey,
					address: address,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
					rawMessage: bytesToHex(cbor.encode(message)),
					rawSignature: bytesToHex(cbor.encode(signature)),
				})
			} else if (AbstractRuntime.isAction(message)) {
				const { address, timestamp } = message.payload

				const sessions = await runtime.db.query("$sessions", {
					where: {
						public_key: signature.publicKey,
						address: address,
						expiration: { gte: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(`missing session ${signature.publicKey} for $${address}`)
				}

				const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(runtime.db.models, () => ({}))

				const result = await runtime.execute({ txn: this, modelEntries, id, signature, message })

				const effects: Effect[] = []

				for (const [model, entries] of Object.entries(modelEntries)) {
					for (const [key, value] of Object.entries(entries)) {
						const keyHash = AbstractRuntime.getKeyHash(key)

						if (runtime.indexHistory) {
							const effectKey = `${model}/${keyHash}/${id}`
							const results = await runtime.db.query("$effects", {
								select: { key: true },
								where: { key: { gt: effectKey, lte: `${model}/${keyHash}/${MAX_MESSAGE_ID}` } },
								limit: 1,
							})

							effects.push({
								model: "$effects",
								operation: "set",
								value: { key: effectKey, value: value && cbor.encode(value) },
							})

							if (results.length > 0) {
								runtime.log("skipping effect %o because it is superceeded by effects %O", [key, value], results)
								continue
							}
						} else {
							const versionKey = `${model}/${keyHash}`
							const existingVersionRecord = await runtime.db.get("$versions", versionKey)
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

				runtime.log("applying effects %O", effects)
				if (effects.length > 0) {
					await runtime.db.apply(effects)
				}

				return result
			} else {
				throw new Error("invalid message payload type")
			}
		}
	}

	protected static getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

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
		const lowerBound = `${model}/${keyHash}/${MIN_MESSAGE_ID}`
		let upperBound = `${model}/${keyHash}/${MAX_MESSAGE_ID}`

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const results = await this.db.query<{ key: string; value: Uint8Array }>("$effects", {
				where: { key: { gte: lowerBound, lt: upperBound } },
				orderBy: { key: "desc" },
				limit: 1,
			})

			if (results.length === 0) {
				return null
			}

			const [{ key: effectKey, value }] = results
			const [{}, {}, messageId] = effectKey.split("/")

			upperBound = effectKey as string
			const visited = new Set<string>()

			for (const parent of context.message.parents) {
				const isAncestor = await context.txn.isAncestor(encodeId(parent), encodeId(messageId), visited)
				if (isAncestor) {
					return cbor.decode<null | T>(value)
				}
			}

			upperBound = effectKey
		}
	}
}
