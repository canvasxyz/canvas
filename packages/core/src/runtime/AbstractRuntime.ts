import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import type { Action, CBORValue, Session, SessionSigner } from "@canvas-js/interfaces"

import { AbstractModelDB, Effect, ModelValue, ModelsInit, lessThan } from "@canvas-js/modeldb"
import { GossipLogConsumer, encodeId } from "@canvas-js/gossiplog"

import { MAX_MESSAGE_ID } from "../constants.js"
import { assert, mapValues, signalInvalidType } from "../utils.js"

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

	public abstract readonly signers: SessionSigner[]
	public abstract readonly db: AbstractModelDB
	public abstract readonly actionNames: string[]

	protected constructor(public readonly indexHistory: boolean) {}

	protected abstract execute(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<void | CBORValue>

	public async close() {
		await this.db.close()
	}

	public getConsumer(): GossipLogConsumer<Action | Session, void | CBORValue> {
		return async (id, signature, message) => {
			assert(signature !== null, "missing message signature")

			if (message.payload.type === "action") {
				const { chain, address, timestamp } = message.payload

				const sessions = await this.db.query("$sessions", {
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

				const modelEntries: Record<string, Record<string, ModelValue | null>> = mapValues(this.db.models, () => ({}))

				const result = await this.execute(modelEntries, id, message.payload)

				const effects: Effect[] = []

				for (const [model, entries] of Object.entries(modelEntries)) {
					for (const [key, value] of Object.entries(entries)) {
						const keyHash = bytesToHex(blake3(key, { dkLen: 16 }))

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
								continue
							}
						} else {
							const versionKey = `${model}/${keyHash}`
							const existingVersionRecord = await this.db.get("$versions", versionKey)
							const { version: existingVersion } = existingVersionRecord ?? { version: null }

							assert(
								existingVersion === null || existingVersion instanceof Uint8Array,
								"expected version === null || version instanceof Uint8Array"
							)

							const currentVersion = encodeId(id)
							if (existingVersion !== null && lessThan(currentVersion, existingVersion)) {
								continue
							} else {
								effects.push({
									model: "$versions",
									operation: "set",
									value: { key: versionKey, version: currentVersion },
								})
							}
						}

						if (value === null) {
							effects.push({ model, operation: "delete", key })
						} else {
							effects.push({ model, operation: "set", value })
						}
					}
				}

				if (effects.length > 0) {
					await this.db.apply(effects)
				}

				return result
			} else if (message.payload.type === "session") {
				const { publicKeyType, publicKey, chain, address, timestamp, duration } = message.payload

				const signer = this.signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, "no signer found")

				assert(publicKeyType === signature.type && equals(publicKey, signature.publicKey))
				await signer.verifySession(message.payload)

				await this.db.set("$sessions", {
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

	protected async getModelValue(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		model: string,
		key: string
	): Promise<null | ModelValue> {
		if (this.indexHistory) {
			throw new Error("not implemented")

			// if (modelEntries[model][key] !== undefined) {
			// 	return modelEntries[model][key]
			// }

			// return null
		} else {
			throw new Error("cannot call .get if indexHistory is disabled")
		}
	}
}
