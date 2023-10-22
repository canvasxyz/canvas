import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"
import { TypeTransformerFunction } from "@ipld/schema/typed.js"
import { logger } from "@libp2p/logger"

import type { Action, CBORValue, Message, Session, SessionSigner } from "@canvas-js/interfaces"
import { Signature } from "@canvas-js/signed-cid"

import { AbstractModelDB, Effect, ModelValue, ModelsInit, lessThan } from "@canvas-js/modeldb"
import { AbstractGossipLog, GossipLogConsumer, ReadOnlyTransaction, encodeId, getClock } from "@canvas-js/gossiplog"

import { MAX_MESSAGE_ID, MIN_MESSAGE_ID } from "../constants.js"
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
			public_key_type: "string",
			public_key: "bytes",
			chain: "string",
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

	public abstract readonly signers: SessionSigner[]
	public abstract readonly db: AbstractModelDB
	public abstract readonly actionNames: string[]

	protected abstract readonly actionCodecs: Record<
		string,
		{ toTyped: TypeTransformerFunction; toRepresentation: TypeTransformerFunction }
	>

	protected readonly log = logger("canvas:runtime")
	protected constructor(public readonly indexHistory: boolean) {}

	protected abstract execute(context: ExecutionContext, action: Action): Promise<void | CBORValue>

	public async close() {
		await this.db.close()
	}

	public getConsumer(): GossipLogConsumer<Action | Session, void | CBORValue> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const runtime = this

		return async function (this: ReadOnlyTransaction, id, signature, message) {
			assert(signature !== null, "missing message signature")

			if (message.payload.type === "action") {
				const { chain, address, timestamp } = message.payload

				const sessions = await runtime.db.query("$sessions", {
					where: {
						// 	key: {
						// 		gte: `${signature.type}:${bytesToHex(signature.publicKey)}:${MIN_MESSAGE_ID}`,
						// 		lt: `${signature.type}:${bytesToHex(signature.publicKey)}:${id}`,
						// 	},
						public_key_type: signature.type,
						public_key: signature.publicKey,
						chain: chain,
						address: address,
						expiration: { gt: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(
						`missing session ${signature.type}:0x${bytesToHex(signature.publicKey)} for ${chain}:${address}`
					)
				}

				const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(runtime.db.models, () => ({}))

				const result = await runtime.execute(
					{ txn: this, modelEntries, id, signature, message: { ...message, payload: message.payload } },
					message.payload
				)

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
								"expected version === null || version instanceof Uint8Array"
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
			} else if (message.payload.type === "session") {
				const { publicKeyType, publicKey, chain, address, timestamp, duration } = message.payload

				const signer = runtime.signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, "no signer found")

				assert(publicKeyType === signature.type && equals(publicKey, signature.publicKey))
				await signer.verifySession(message.payload)

				await runtime.db.set("$sessions", {
					// key: `${signature.type}:${bytesToHex(signature.publicKey)}:${id}`,
					message_id: id,
					public_key_type: signature.type,
					public_key: signature.publicKey,
					chain: chain,
					address: address,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
				})
			} else {
				signalInvalidType(message.payload)
			}
		}
	}

	protected static getKeyHash = (key: string) => bytesToHex(blake3(key, { dkLen: 16 }))

	protected async getModelValue<T extends ModelValue = ModelValue>(
		context: ExecutionContext,
		model: string,
		key: string
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
