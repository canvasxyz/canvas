import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { logger } from "@libp2p/logger"
import { TypeTransformerFunction } from "@ipld/schema/typed.js"

import type { Signature, Action, Message, Session, SessionSigner, Heartbeat } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelsInit, lessThan } from "@canvas-js/modeldb"
import {
	AbstractGossipLog,
	GossipLogConsumer,
	ReadOnlyTransaction,
	encodeId,
	MAX_MESSAGE_ID,
	MIN_MESSAGE_ID,
} from "@canvas-js/gossiplog"

import { assert, mapValues, signalInvalidType } from "../utils.js"

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
	public abstract readonly signers: SessionSigner[]
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

	public getConsumer(): GossipLogConsumer<Action | Session | Heartbeat, void | any> {
		return async (id, signature, message, { txn }) => {
			if (message.payload.type === "heartbeat") {
				assert(message.clock === 0, "expected message.clock === 0 for heartbeats")
				assert(txn === undefined, "expected txn === undefined for heartbeats")
			} else if (message.payload.type === "session") {
				assert(message.clock > 0, "expected message.clock !== 0 for sessions")
				assert(txn !== undefined, "expected txn !== undefined for sessions")

				const { publicKey, address, timestamp, duration } = message.payload

				const signer = this.signers.find((signer) => signer.match(address))
				assert(signer !== undefined, "no signer found")

				assert(publicKey === signature.publicKey)

				await signer.verifySession(this.topic, message.payload)

				await this.db.set("$sessions", {
					message_id: id,
					public_key: publicKey,
					address: address,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
				})
			} else if (message.payload.type === "action") {
				assert(message.clock > 0, "expected message.clock !== 0 for actions")
				assert(txn !== undefined, "expected txn !== undefined for actions")

				const { address, timestamp } = message.payload

				const sessions = await this.db.query("$sessions", {
					where: {
						public_key: signature.publicKey,
						address: address,
						expiration: { gte: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(`missing session ${signature.publicKey} for $${address}`)
				}

				const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(this.db.models, () => ({}))

				const result = await this.execute({ txn, modelEntries, id, signature, message: message as Message<Action> })

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
								value: { key: effectKey, value: value && cbor.encode(value) },
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
			} else {
				signalInvalidType(message.payload)
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

		assert(context.txn.ancestors !== undefined, "expected txn.ancestors !== undefined")
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
				const isAncestor = await AbstractGossipLog.isAncestor(context.txn, parent, messageId, visited)
				if (isAncestor) {
					return cbor.decode<null | T>(value)
				}
			}

			upperBound = effectKey
		}
	}
}
