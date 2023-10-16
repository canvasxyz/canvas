import { QuickJSHandle } from "quickjs-emscripten"

import * as cbor from "@ipld/dag-cbor"
import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import type { Action, Session, SessionSigner } from "@canvas-js/interfaces"
import { JSValue, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Effect,
	Model,
	ModelValue,
	ModelsInit,
	Property,
	PropertyValue,
	lessThan,
	validateModelValue,
} from "@canvas-js/modeldb"
import { AbstractGossipLog, GossipLogConsumer, encodeId } from "@canvas-js/gossiplog"
import { getCID } from "@canvas-js/signed-cid"

import { PlatformTarget } from "../targets/interface.js"
import { MAX_MESSAGE_ID } from "../constants.js"
import { assert, mapValues, signalInvalidType } from "../utils.js"

import type { ActionImplementation, ModelAPI } from "./types.js"

// import { ContractRuntime } from "./ContractRuntime.js"
// import { FunctionRuntime } from "./FunctionRuntime.js"

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

	public static init(
		target: PlatformTarget,
		signers: SessionSigner[],
		contract: string | { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
		options: { runtimeMemoryLimit?: number; indexHistory?: boolean } = {}
	): Promise<AbstractRuntime> {
		if (typeof contract === "string") {
			return ContractRuntime.init(target, signers, contract, options)
		} else {
			return FunctionRuntime.init(target, signers, contract)
		}
	}

	public abstract signers: SessionSigner[]
	public abstract topic: string
	public abstract db: AbstractModelDB
	public abstract actionNames: string[]

	protected constructor(public readonly indexHistory: boolean) {}

	protected abstract execute(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<void | JSValue>

	public async close() {
		await this.db.close()
	}

	public getConsumer(): GossipLogConsumer<Action | Session, void | JSValue> {
		const runtime = this

		return async function (this: AbstractGossipLog<Action | Session, void | JSValue>, id, signature, message) {
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

				const result = await runtime.execute(modelEntries, id, message.payload)

				const effects: Effect[] = []

				for (const [model, entries] of Object.entries(modelEntries)) {
					for (const [key, value] of Object.entries(entries)) {
						const keyHash = bytesToHex(blake3(key, { dkLen: 16 }))

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

export class FunctionRuntime extends AbstractRuntime {
	public static async init(
		target: PlatformTarget,
		signers: SessionSigner[],
		contract: { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> },
		options: { indexHistory?: boolean } = {}
	): Promise<FunctionRuntime> {
		const { indexHistory = true } = options
		if (indexHistory) {
			const db = await target.openDB("models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			})
			return new FunctionRuntime(signers, contract.topic, db, contract.actions, indexHistory)
		} else {
			const db = await target.openDB("models", {
				...contract.models,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			})

			return new FunctionRuntime(signers, contract.topic, db, contract.actions, indexHistory)
		}
	}

	constructor(
		public readonly signers: SessionSigner[],
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		public readonly actions: Record<string, ActionImplementation>,
		indexHistory: boolean
	) {
		super(indexHistory)
	}

	public get actionNames() {
		return Object.keys(this.actions)
	}

	protected async execute(
		// gossipLog: AbstractGossipLog<Action | Session, void | JSValue>,
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<JSValue | void> {
		const { chain, address, name, args, blockhash, timestamp } = action
		assert(this.actions[name] !== undefined, `invalid action name: ${name}`)

		const api = mapValues(this.db.models, (model): ModelAPI => {
			const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
			assert(primaryKeyProperty !== undefined)

			return {
				get: async (key: string) => {
					if (this.indexHistory) {
						throw new Error("not implemented")

						// if (modelEntries[model.name][key] !== undefined) {
						// 	return modelEntries[model.name][key]
						// }

						// return null
					} else {
						throw new Error("cannot call .get if indexHistory is disabled")
					}
				},
				set: async (value: ModelValue) => {
					validateModelValue(model, value)
					const key = value[primaryKeyProperty.name] as string
					modelEntries[model.name][key] = value
				},
				delete: async (key: string) => {
					modelEntries[model.name][key] = null
				},
			}
		})

		return await this.actions[name](api, args, { id, chain, address, blockhash, timestamp })
	}
}

export class ContractRuntime extends AbstractRuntime {
	public static async init(
		target: PlatformTarget,
		signers: SessionSigner[],
		contract: string,
		options: { runtimeMemoryLimit?: number; indexHistory?: boolean } = {}
	): Promise<ContractRuntime> {
		const { runtimeMemoryLimit, indexHistory = true } = options

		const cid = getCID(contract, { codec: "raw", digest: "blake3-128" })
		const uri = `canvas:${cid.toString()}`

		const vm = await VM.initialize({ runtimeMemoryLimit })

		const {
			topic: topicHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = await vm.import(contract, { uri }).then((handle) => handle.consume(vm.unwrapObject))

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		const topic = topicHandle?.consume(vm.context.getString) ?? cid.toString()

		assert(actionsHandle !== undefined, "missing `actions` export")
		const actionHandles = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action[name] to be a function")
			return handle.consume(vm.cache)
		})

		// TODO: validate that models satisfies ModelsInit
		assert(modelsHandle !== undefined, "missing `models` export")
		const modelsInit = modelsHandle.consume(vm.context.dump) as ModelsInit

		if (indexHistory) {
			const db = await target.openDB("db", {
				...modelsInit,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.effectsModel,
			})

			return new ContractRuntime(signers, topic, db, vm, actionHandles, indexHistory)
		} else {
			const db = await target.openDB("db", {
				...modelsInit,
				...AbstractRuntime.sessionsModel,
				...AbstractRuntime.versionsModel,
			})

			return new ContractRuntime(signers, topic, db, vm, actionHandles, indexHistory)
		}
	}

	readonly #databaseAPI: QuickJSHandle

	#context: { id: string; modelEntries: Record<string, Record<string, ModelValue | null>> } | null = null

	constructor(
		public readonly signers: SessionSigner[],
		public readonly topic: string,
		public readonly db: AbstractModelDB,
		private readonly vm: VM,
		private readonly actionHandles: Record<string, QuickJSHandle>,
		indexHistory: boolean
	) {
		super(indexHistory)
		this.#databaseAPI = vm
			.wrapObject(Object.fromEntries(db.config.models.map((model) => [model.name, this.createAPI(model)])))
			.consume(vm.cache)
	}

	public async close() {
		try {
			await super.close()
		} finally {
			this.vm.dispose()
		}
	}

	public get actionNames() {
		return Object.keys(this.actionHandles)
	}

	protected async execute(
		modelEntries: Record<string, Record<string, ModelValue | null>>,
		id: string,
		action: Action
	): Promise<void | JSValue> {
		const { chain, address, name, args, blockhash, timestamp } = action

		const actionHandle = this.actionHandles[name]
		assert(actionHandle !== undefined, `invalid action name: ${name}`)

		this.#context = { id, modelEntries }

		const argsHandle = this.vm.wrapValue(args)
		const ctxHandle = this.vm.wrapValue({ id, chain, address, blockhash, timestamp })
		try {
			const result = await this.vm.callAsync(actionHandle, actionHandle, [this.#databaseAPI, argsHandle, ctxHandle])

			return result.consume((handle) => {
				if (this.vm.context.typeof(handle) === "undefined") {
					return undefined
				} else {
					return this.vm.unwrapValue(result)
				}
			})
		} finally {
			argsHandle.dispose()
			ctxHandle.dispose()
			this.#context = null
		}
	}

	private createAPI(model: Model): QuickJSHandle {
		const primaryKeyProperty = model.properties.find((property) => property.kind === "primary")
		assert(primaryKeyProperty !== undefined)

		return this.vm.wrapObject({
			get: this.vm.wrapFunction((key) => {
				assert(this.#context !== null, "expected this.#context !== null")
				assert(typeof key === "string")
				return this.getModelValue(this.#context.modelEntries, this.#context.id, model.name, key)
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (valueHandle) => {
				assert(this.#context !== null, "expected this.#modelEntries !== null")
				const value = this.unwrapModelValue(model, valueHandle)
				this.#context.modelEntries[model.name][primaryKeyProperty.name] = value
			}),
			delete: this.vm.context.newFunction(`db.${model.name}.delete`, (keyHandle) => {
				assert(this.#context !== null, "expected this.#modelEntries !== null")
				const key = this.vm.context.getString(keyHandle)
				this.#context.modelEntries[model.name][key] = null
			}),
		})
	}

	private unwrapModelValue(model: Model, handle: QuickJSHandle): ModelValue {
		const values = model.properties.map<[string, PropertyValue]>((property) => {
			const propertyHandle = this.vm.context.getProp(handle, property.name)
			const propertyValue = propertyHandle.consume((handle) => this.unwrapPropertyValue(property, handle))
			return [property.name, propertyValue]
		})

		return Object.fromEntries(values)
	}

	private unwrapPropertyValue(property: Property, handle: QuickJSHandle): PropertyValue {
		if (property.kind === "primary") {
			return this.vm.context.getString(handle)
		} else if (property.kind === "primitive") {
			if (property.type === "integer") {
				const value = this.vm.context.getNumber(handle)
				assert(Number.isSafeInteger(value), "property value must be a safe integer")
				return value
			} else if (property.type === "float") {
				return this.vm.context.getNumber(handle)
			} else if (property.type === "string") {
				return this.vm.context.getString(handle)
			} else if (property.type === "bytes") {
				return this.vm.getUint8Array(handle)
			} else {
				signalInvalidType(property.type)
			}
		} else if (property.kind === "reference") {
			if (this.vm.is(handle, this.vm.context.null)) {
				return null
			} else {
				return this.vm.context.getString(handle)
			}
		} else if (property.kind === "relation") {
			// // TODO: this might need to be consumed...
			// return this.vm.unwrapArray(handle, (elementHandle) => this.vm.context.getString(elementHandle))
			return this.vm.unwrapArray(handle, (elementHandle) => elementHandle.consume(this.vm.context.getString))
		} else {
			signalInvalidType(property)
		}
	}
}
