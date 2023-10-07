import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interface/events"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { base32hex } from "multiformats/bases/base32"
import { QuickJSHandle } from "quickjs-emscripten"
import { bytesToHex as hex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import { lessThan } from "@canvas-js/okra"
import { Action, ActionArguments, Session, Message, SessionSigner } from "@canvas-js/interfaces"
import { JSValue, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Effect,
	getImmutableRecordKey,
	Model,
	ModelsInit,
	ModelValue,
	Property,
	PropertyValue,
	Resolver,
	validateModelValue,
} from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { getCID, Signature } from "@canvas-js/signed-cid"
import { AbstractGossipLog, MessageSigner } from "@canvas-js/gossiplog"

import getTarget from "#target"

import { ServiceMap } from "./targets/interface.js"
import { Awaitable, assert, mapEntries, mapValues, signalInvalidType } from "./utils.js"

export type ActionImplementation = (
	db: Record<string, ModelAPI>,
	args: JSValue,
	context: ActionContext
) => Awaitable<void | JSValue>

export type ModelAPI = {
	get: (key: string) => Promise<ModelValue | null>
	add: (value: ModelValue) => Promise<void>
	set: (key: string, value: ModelValue) => Promise<void>
	delete: (key: string) => Promise<void>
}

export type ActionContext = { id: string; chain: string; address: string; blockhash: string | null; timestamp: number }

export type ApplyMessage = (
	id: string,
	signature: Signature | null,
	message: Message<Action | Session>
) => Promise<JSValue | void>

export interface CanvasConfig {
	contract: string | { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> }

	/** NodeJS: data directory path; browser: IndexedDB database namespace */
	location?: string | null
	uri?: string

	signers?: SessionSigner[]
	replay?: boolean
	runtimeMemoryLimit?: number

	offline?: boolean
	start?: boolean
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export type ActionAPI = (
	args: ActionArguments,
	options?: { chain?: string; signer?: SessionSigner }
) => Promise<{ id: string; result: void | JSValue; recipients: Promise<PeerId[]> }>

export interface CoreEvents {
	close: Event
	// TODO: should this be {signature: Signature, Message: Message} ?
	message: CustomEvent<{}>
	// TODO: what should this be
	update: CustomEvent<{}>
	// TODO: what should this be
	sync: CustomEvent<{}>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
}

export type ApplicationData = {
	uri: string
	peerId: string
	models: Record<string, Model>
	topics: Record<string, { actions: string[] | null }>
}

export class Canvas extends EventEmitter<CoreEvents> {
	public static async initialize(config: CanvasConfig): Promise<Canvas> {
		if (typeof config.contract === "string") {
			return await Canvas.initializeContract(config, config.contract)
		} else {
			return await Canvas.initializeFunctions(config, config.contract)
		}
	}

	private static async initializeContract(config: CanvasConfig, contract: string): Promise<Canvas> {
		const { signers = [], runtimeMemoryLimit, replay = false, offline = false } = config

		const location = config.location ?? null
		const target = getTarget(location)

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const peerId = await target.getPeerId()
		let libp2p: Libp2p<ServiceMap> | null = null
		if (!offline) {
			libp2p = await target.createLibp2p(config, peerId)
		}

		const cid = getCID(contract, { codec: "raw", digest: "blake3-128" })
		const uri = config.uri ?? `canvas:${cid.toString()}`

		const sessionDB = await target.openDB("sessions", Canvas.sessionSchema)

		// Create a QuickJS VM
		const vm = await VM.initialize({ runtimeMemoryLimit })

		const {
			topic: topicHandle,
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = await vm.import(contract, { uri }).then((handle) => handle.consume(vm!.unwrapObject))

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		const topic = topicHandle?.consume(vm.context.getString) ?? cid.toString()

		// TODO: validate that models satisfies ModelsInit
		assert(modelsHandle !== undefined, "missing `models` export")
		const models = modelsHandle.consume(vm.context.dump) as ModelsInit

		const db = await target.openDB("db", models, { resolver: Canvas.resolver })
		const databaseAPI = new DatabaseAPI(vm, db)

		assert(actionsHandle !== undefined, "missing `models` export")
		const actionHandles = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) => {
			assert(vm.context.typeof(handle) === "function", "expected action[name] to be a function")
			return handle.consume(vm.cache)
		})

		const apply = async (id: string, signature: Signature | null, message: Message<Action | Session>) => {
			assert(signature !== null, "missing message signature")

			if (message.payload.type === "action") {
				const { chain, address, name, args, blockhash, timestamp } = message.payload

				const sessions = await sessionDB.query("sessions", {
					where: {
						public_key_type: signature.type,
						public_key: signature.publicKey,
						chain: chain,
						address: address,
						expiration: { gt: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(`missing session [${signature.type} 0x${hex(signature.publicKey)}] for ${chain}:${address}`)
				}

				const actionHandle = actionHandles[name]
				assert(actionHandle !== undefined, `invalid action name: ${name}`)

				const { result, effects } = await databaseAPI.collect(async () => {
					const argsHandle = vm.wrapValue(args)
					const ctxHandle = vm.wrapValue({ id, chain, address, blockhash, timestamp })
					try {
						const result = await vm.callAsync(actionHandle, actionHandle, [databaseAPI.handle, argsHandle, ctxHandle])
						return result.consume((handle) => {
							if (vm.context.typeof(handle) === "undefined") {
								return undefined
							} else {
								return vm.unwrapValue(result)
							}
						})
					} finally {
						argsHandle.dispose()
						ctxHandle.dispose()
					}
				})

				await db.apply(effects, { version: base32hex.baseDecode(id) })

				return result
			} else if (message.payload.type === "session") {
				const { publicKeyType, publicKey, chain, address, timestamp, duration } = message.payload
				const signer = signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, "no signer found")
				assert(publicKeyType === signature.type && equals(publicKey, signature.publicKey))
				await signer.verifySession(message.payload)
				await sessionDB.add("sessions", {
					message_id: id,
					chain: chain,
					address: address,
					public_key_type: signature.type,
					public_key: signature.publicKey,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
				})
			} else {
				signalInvalidType(message.payload)
			}
		}

		const gossipLog = await target.openGossipLog({
			topic,
			apply,
			replay,
			validate: Canvas.validate,
			signatures: true,
			sequencing: true,
		})

		await libp2p?.services.gossiplog.subscribe(gossipLog, {})

		const actionNames = Object.keys(actionHandles)
		const app = new Canvas(uri, signers, peerId, libp2p, db, sessionDB, gossipLog, actionNames)
		app.controller.signal.addEventListener("abort", () => vm.dispose())
		return app
	}

	private static async initializeFunctions(
		config: CanvasConfig,
		contract: { topic: string; models: ModelsInit; actions: Record<string, ActionImplementation> }
	): Promise<Canvas> {
		const { signers = [], replay = false, offline = false } = config

		const location = config.location ?? null
		const target = getTarget(location)

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const peerId = await target.getPeerId()
		let libp2p: Libp2p<ServiceMap> | null = null
		if (!offline) {
			libp2p = await target.createLibp2p(config, peerId)
		}

		const uri = config.uri ?? `canvas:${contract.topic}`

		const sessionDB = await target.openDB("sessions", Canvas.sessionSchema)

		const db = await target.openDB("db", contract.models, { resolver: Canvas.resolver })

		const apply: ApplyMessage = async (id, signature, message) => {
			assert(signature !== null, "missing message signature")

			if (message.payload.type === "action") {
				const { chain, address, name, args, blockhash, timestamp } = message.payload

				const sessions = await sessionDB.query("sessions", {
					where: {
						public_key_type: signature.type,
						public_key: signature.publicKey,
						chain: chain,
						address: address,
						expiration: { gt: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(`missing session [${signature.type} 0x${hex(signature.publicKey)}] for ${chain}:${address}`)
				}

				assert(contract.actions[name] !== undefined, `invalid action name: ${name}`)

				const effects: Effect[] = []

				const api = mapEntries(db.models, ([name, model]) => {
					return {
						get: async (key: string) => {
							throw new Error("not implemented")
						},
						add: async (value: ModelValue) => {
							validateModelValue(model, value)
							const key = getImmutableRecordKey(value)
							effects.push({ model: model.name, operation: "set", key, value })
						},
						set: async (key: string, value: ModelValue) => {
							validateModelValue(model, value)
							effects.push({ model: model.name, operation: "set", key, value })
						},
						delete: async (key: string) => {
							effects.push({ model: model.name, operation: "delete", key })
						},
					}
				})

				const result = await contract.actions[name](api, args, { id, chain, address, blockhash, timestamp })

				await db.apply(effects, { version: base32hex.baseDecode(id) })

				return result
			} else if (message.payload.type === "session") {
				const { publicKeyType, publicKey, chain, address, timestamp, duration } = message.payload
				const signer = signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, "no signer found")
				assert(publicKeyType === signature.type && equals(publicKey, signature.publicKey))
				await signer.verifySession(message.payload)
				await sessionDB.add("sessions", {
					message_id: id,
					chain: chain,
					address: address,
					public_key_type: signature.type,
					public_key: signature.publicKey,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
				})
			} else {
				signalInvalidType(message.payload)
			}
		}

		const messageLog = await target.openGossipLog({
			topic: contract.topic,
			apply,
			replay,
			validate: Canvas.validate,
			signatures: true,
			sequencing: true,
		})

		await libp2p?.services.gossiplog.subscribe(messageLog, {})

		const actionNames = Object.keys(contract.actions)
		return new Canvas(uri, signers, peerId, libp2p, db, sessionDB, messageLog, actionNames)
	}

	private static validate = (payload: unknown): payload is Action | Session => true // TODO
	private static resolver: Resolver = { lessThan: (a, b) => lessThan(a.version, b.version) }

	private static sessionSchema = {
		sessions: {
			message_id: "string",
			chain: "string",
			address: "string",
			public_key_type: "string",
			public_key: "bytes",
			expiration: "integer?",
			$indexes: [["address"], ["public_key"]],
		},
	} satisfies ModelsInit

	public readonly actions: Record<string, ActionAPI> = {}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	#open = true

	private constructor(
		public readonly uri: string,
		public readonly signers: SessionSigner[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly db: AbstractModelDB,
		public readonly sessionDB: AbstractModelDB,
		public readonly messageLog: AbstractGossipLog<Action | Session, JSValue | void>,
		actionNames: string[]
	) {
		super()

		libp2p?.addEventListener("peer:discovery", ({ detail: { id, multiaddrs, protocols } }) => {
			this.log("discovered peer %p with protocols %o", id, protocols)
		})

		libp2p?.addEventListener("peer:connect", ({ detail: peerId }) => {
			this.log("connected to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		libp2p?.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this.log("disconnected %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})

		for (const name of actionNames) {
			this.actions[name] = async (args, options = {}) => {
				const signer =
					options.signer ?? signers.find((signer) => options.chain === undefined || signer.match(options.chain))
				assert(signer !== undefined, "signer not found")

				const timestamp = Date.now()

				const session = await signer.getSession(this.topic, { timestamp, chain: options.chain })

				const { chain, address, publicKeyType: public_key_type, publicKey: public_key } = session

				// Check if the session has already been added to the message log
				const results = await sessionDB.query("sessions", {
					where: { chain, address, public_key_type, public_key, expiration: { gt: timestamp } },
					limit: 1,
				})

				this.log("got %d matching sessions: %o", results.length, results)

				if (results.length === 0) {
					const { id: sessionId } = await this.append(session, { signer })
					this.log("created session %s", sessionId)
				}

				const { id, result, recipients } = await this.append(
					{ type: "action", chain, address, name, args, blockhash: null, timestamp },
					{ signer }
				)

				this.log("applied action %s and got result %o", id, result)

				return { id, result, recipients }
			}
		}
	}

	public get topic(): string {
		return this.messageLog.topic
	}

	public async start() {
		await this.libp2p?.start()
	}

	public async stop() {
		await this.libp2p?.stop()
	}

	public async close() {
		if (this.#open) {
			this.#open = false
			this.controller.abort()
			await this.libp2p?.stop()
			await this.messageLog.close()
			await this.db.close()
			this.dispatchEvent(new Event("close"))
			this.log("closed")
		}
	}

	public getApplicationData(): ApplicationData {
		return {
			uri: this.uri,
			peerId: this.peerId.toString(),
			models: this.db.models,
			topics: { [this.topic]: { actions: Object.keys(this.actions) } },
		}
	}

	/**
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async insert(signature: Signature | null, message: Message<Session | Action>): Promise<{ id: string }> {
		if (this.libp2p === null) {
			return this.messageLog.insert(signature, message)
		} else {
			const { id } = await this.libp2p.services.gossiplog.insert(this.topic, signature, message)
			return { id }
		}
	}

	/**
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async append(
		payload: Session | Action,
		options: { signer?: MessageSigner<Session | Action> }
	): Promise<{ id: string; result: void | JSValue; recipients: Promise<PeerId[]> }> {
		if (this.libp2p === null) {
			const { id, result } = await this.messageLog.append(payload, options)
			return { id, result, recipients: Promise.resolve([]) }
		} else {
			return this.libp2p.services.gossiplog.append(this.topic, payload, options)
		}
	}

	public async getMessage(
		id: string
	): Promise<[signature: Signature | null, message: Message<Action | Session> | null]> {
		return await this.messageLog.get(id)
	}

	public async *getMessageStream<Payload = Action>(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[id: string, signature: Signature | null, message: Message<Payload>]> {
		for await (const [id, signature, message] of this.messageLog.iterate(lowerBound, upperBound, options)) {
			yield [id, signature, message as Message<Payload>]
		}
	}
}

class DatabaseAPI {
	public readonly handle: QuickJSHandle

	#effects: Effect[] | null = null

	constructor(readonly vm: VM, readonly db: AbstractModelDB) {
		this.handle = vm
			.wrapObject(Object.fromEntries(db.config.models.map((model) => [model.name, this.createAPI(model)])))
			.consume(vm.cache)
	}

	public async collect<T>(callback: () => Promise<T>): Promise<{ result: T; effects: Effect[] }> {
		this.#effects = []
		try {
			const result = await callback()
			return { result, effects: this.#effects }
		} finally {
			this.#effects = null
		}
	}

	public createAPI(model: Model): QuickJSHandle {
		return this.vm.wrapObject({
			get: this.vm.context.newFunction(`db.${model.name}.get`, (keyHandle) => {
				assert(this.#effects !== null, "internal error")
				throw new Error("not implemented")
			}),
			add: this.vm.context.newFunction(`db.${model.name}.add`, (valueHandle) => {
				assert(this.#effects !== null, "internal error")
				const value = this.unwrapModelValue(model, valueHandle)
				const key = getImmutableRecordKey(value)
				this.#effects.push({ model: model.name, operation: "set", key, value })
				return this.vm.context.newString(key)
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (keyHandle, valueHandle) => {
				assert(this.#effects !== null, "internal error")
				const key = this.vm.context.getString(keyHandle)
				const value = this.unwrapModelValue(model, valueHandle)
				this.#effects.push({ model: model.name, operation: "set", key, value })
			}),
			delete: this.vm.context.newFunction(`db.${model.name}.delete`, (keyHandle) => {
				assert(this.#effects !== null, "internal error")
				const key = this.vm.context.getString(keyHandle)
				this.#effects.push({ model: model.name, operation: "delete", key })
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
		if (property.kind === "primitive") {
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
				const value = this.vm.context.getString(handle)
				// TODO: assert that value matches ID format
				return value
			}
		} else if (property.kind === "relation") {
			const values = this.vm.unwrapArray(handle, (elementHandle) => this.vm.context.getString(elementHandle))
			// TODO: assert that values match ID format
			return values
		} else {
			signalInvalidType(property)
		}
	}
}
