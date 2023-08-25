import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { logger } from "@libp2p/logger"
import { CID } from "multiformats/cid"
import { base32 } from "multiformats/bases/base32"

import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

import { QuickJSHandle } from "quickjs-emscripten"

import { Action, ActionArguments, ActionContext, Signer } from "@canvas-js/interfaces"
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
	Resolve,
} from "@canvas-js/modeldb-interface"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { GossipLog, GossipLogConsumer, GossipLogInit } from "@canvas-js/gossiplog"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "./libp2p.js"
import { assert, mapEntries, signalInvalidType } from "./utils.js"
import { getCID } from "@canvas-js/signed-cid"

export interface CanvasConfig extends P2PConfig {
	contract: string

	/** NodeJS: data directory path, browser: IndexedDB database namespace */
	location?: string | null
	topic?: string
	uri?: string

	signers?: Signer[]
	offline?: boolean
	replay?: boolean

	runtimeMemoryLimit?: number
}

export type ActionAPI = Record<
	string,
	(
		args: ActionArguments,
		options?: { chain?: string }
	) => Promise<{ key: Uint8Array; result: void | JSValue; recipients: Promise<PeerId[]> }>
>

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

export class Canvas extends EventEmitter<CoreEvents> {
	public static async initialize(config: CanvasConfig): Promise<Canvas> {
		const { contract, signers = [], replay = false, offline = false, runtimeMemoryLimit } = config

		const location = config.location ?? null
		const target = getTarget(location)

		const cid = getCID(contract, { codec: "raw", digest: "blake3-128" })
		const uri = config.uri ?? `canvas:${cid.toString()}`
		const defaultTopic = config.topic ?? cid.toString()

		if (signers.length === 0) {
			const signer = await SIWESigner.init({})
			signers.push(signer)
		}

		// Create a QuickJS VM
		const vm = await VM.initialize({ runtimeMemoryLimit })

		// We only have two exports: `models` and `actions`.
		const {
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = await vm.import(contract, { uri }).then((handle) => handle.consume(vm.unwrapObject))

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`Extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		// TODO: validate that models satisfies ModelsInit
		const models = modelsHandle.consume(vm.context.dump) as ModelsInit

		// our version strings always sort lexicographically
		const resolve: Resolve = { lessThan: (a, b) => a.version < b.version }
		const db = await target.openDB(uri, models, { resolve })

		// { [topic]: { [name]: handler } }
		const actionHandlers: Record<string, Record<string, QuickJSHandle>> = {}

		// // { [topic]: handler }
		// const customActionHandlers: Record<string, JSFunctionAsync> = {}

		// unwrap actions
		for (const [name, handle] of Object.entries(actionsHandle.consume(vm.unwrapObject))) {
			// We support several action definition formats. The simplest is just a function.
			if (vm.context.typeof(handle) === "function") {
				const topic = defaultTopic
				if (actionHandlers[topic] === undefined) {
					actionHandlers[topic] = {}
				}

				actionHandlers[topic][name] = handle.consume(vm.cache)
			} else {
				throw new Error("not implemented")
			}
		}

		// actionMap maps action names to topics
		const actionMap: Record<string, string> = {}

		// initMap maps topics to inits
		const gossipLogInit: GossipLogInit<Action, JSValue | void>[] = []

		const databaseAPI = new DatabaseAPI(vm, db)

		for (const [topic, actions] of Object.entries(actionHandlers)) {
			const apply: GossipLogConsumer<Action, JSValue | void> = async (key, signature, message) => {
				const id = base32.baseEncode(key)
				const { chain, address, name, args, context } = message.payload

				const signer = signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, `no signer provided for chain ${chain}`)
				await signer.verify(signature, message)

				assert(actions[name] !== undefined, `invalid action name: ${name}`)

				const { result, effects } = await databaseAPI.collect(async () => {
					const argsHandle = vm.wrapValue(args)
					const ctxHandle = vm.wrapValue({ id, chain, address, ...context })
					try {
						const result = await vm.callAsync(actions[name], actions[name], [databaseAPI.handle, argsHandle, ctxHandle])
						return vm.unwrapValue(result)
					} finally {
						argsHandle.dispose()
						ctxHandle.dispose()
					}
				})

				await db.apply(effects, { version: id })

				return { result }
			}

			// TODO: add `validate` to log init
			gossipLogInit.push({ topic, location, apply })
			for (const name of Object.keys(actions)) {
				actionMap[name] = topic
			}
		}

		const peerId = await target.getPeerId()

		// TODO: add `start?: boolean` option and forward it to libp2p
		const libp2p = offline ? null : await createLibp2p(getLibp2pOptions(peerId, config))

		// const gossipLogs = await Promise.all(gossipLogInit.map((init) => GossipLog.init(libp2p, init)))

		const topics = await Promise.all(
			gossipLogInit.map((init) =>
				GossipLog.init(libp2p, init).then(
					(log) => [init.topic, log] satisfies [string, GossipLog<Action, void | JSValue>]
				)
			)
		).then((entries) => new Map(entries))

		const actions: ActionAPI = mapEntries(actionMap, ([actionName, topic]) => {
			const gossipLog = topics.get(topic)
			assert(gossipLog instanceof GossipLog, "GossipLog not found")
			return async (args: ActionArguments, { chain }: { chain?: string } = {}) => {
				const signer = signers.find((signer) => chain === undefined || signer.match(chain))
				assert(signer !== undefined, "signer not found")
				const context: ActionContext = { topic, timestamp: Date.now(), blockhash: null }
				const action = signer.create(actionName, args, context, {})
				const message = await gossipLog.create(action)
				const signature = await signer.sign(message)
				const { key, result, recipients } = await gossipLog.publish(signature, message)
				return { key, result, recipients }
			}
		})

		return new Canvas(uri, signers, peerId, libp2p, vm, db, actions, topics)
	}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	private constructor(
		public readonly uri: string,
		public readonly signers: Signer[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly vm: VM,
		public readonly db: AbstractModelDB,
		public readonly actions: ActionAPI,
		public readonly topics: Map<string, GossipLog<Action, void | JSValue>>
	) {
		super()

		libp2p?.addEventListener("peer:connect", ({ detail: peerId }) => {
			this.log("opened connection to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		libp2p?.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this.log("closed connection to %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})
	}

	public async start() {
		if (this.libp2p !== null) {
			if (!this.libp2p.isStarted()) {
				await this.libp2p.start()
			}

			for (const gossipLog of this.topics.values()) {
				await gossipLog.start()
			}
		}
	}

	public async getApplicationData(): Promise<{ uri: string; peerId: string }> {
		return { uri: this.uri, peerId: this.peerId.toString() }
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null && this.libp2p.isStarted()) {
			await this.libp2p.stop()
		}

		// TODO: make AbstractModelDB.close async
		this.db.close()
		this.vm.dispose()
		this.dispatchEvent(new Event("close"))
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

				if (model.kind === "mutable") {
					throw new Error("cannot .get mutable model values")
				}

				throw new Error("not implemented")
			}),
			add: this.vm.context.newFunction(`db.${model.name}.add`, (valueHandle) => {
				assert(this.#effects !== null, "internal error")

				if (model.kind === "mutable") {
					throw new Error("cannot .add(...) mutable models - use .set(...)")
				}

				const value = this.unwrapModelValue(model, valueHandle)
				this.#effects.push({ model: model.name, operation: "add", value })

				return this.vm.context.newString(getImmutableRecordKey(value, {}))
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (keyHandle, valueHandle) => {
				assert(this.#effects !== null, "internal error")

				if (model.kind === "immutable") {
					throw new Error("cannot .set(...) immutable models - use .add(...)")
				}

				const key = this.vm.context.getString(keyHandle)
				const value = this.unwrapModelValue(model, valueHandle)
				this.#effects.push({ model: model.name, operation: "set", key, value })
			}),
			delete: this.vm.context.newFunction(`db.${model.name}.delete`, (keyHandle) => {
				assert(this.#effects !== null, "internal error")

				if (model.kind === "immutable") {
					throw new Error("cannot .delete(...) immutable models")
				}

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
