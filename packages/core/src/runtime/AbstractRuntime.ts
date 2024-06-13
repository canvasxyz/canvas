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
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const runtime = this

		return async function (this: AbstractGossipLog<Action | Session>, { id, signature, message }) {
			if (AbstractRuntime.isSession(message)) {
				await runtime.handleSession(id, signature, message)
			} else if (AbstractRuntime.isAction(message)) {
				await runtime.handleAction(id, signature, message, this)
			} else {
				throw new Error("invalid message payload type")
			}
		}
	}

	private async handleSession(id: string, signature: Signature, message: Message<Session>) {
		const {
			publicKey,
			address,
			context: { timestamp, duration },
		} = message.payload

		const signer = this.signers
			.getAll()
			.find((signer) => signer.scheme.codecs.includes(signature.codec) && signer.match(address))

		assert(signer !== undefined, "no matching signer found")

		assert(publicKey === signature.publicKey)

		await signer.verifySession(this.topic, message.payload)

		await this.db.set("$sessions", {
			message_id: id,
			public_key: publicKey,
			address: address,
			expiration: duration === undefined ? Number.MAX_SAFE_INTEGER : timestamp + duration,
			rawMessage: bytesToHex(cbor.encode(message)),
			rawSignature: bytesToHex(cbor.encode(signature)),
		})
	}

	private async handleAction(
		id: string,
		signature: Signature,
		message: Message<Action>,
		messageLog: AbstractGossipLog<Action | Session>,
	) {
		const {
			address,
			context: { timestamp },
		} = message.payload

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

		const result = await this.execute({ messageLog, modelEntries, id, signature, message })

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
				const isAncestor = await context.messageLog.isAncestor(parent, messageId, visited)
				if (isAncestor) {
					return cbor.decode<null | T>(value)
				}
			}

			upperBound = effectKey
		}
	}
}
