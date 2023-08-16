import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { logger } from "@libp2p/logger"
import { bytesToHex } from "@noble/hashes/utils"
import { CID } from "multiformats/cid"
import { base32 } from "multiformats/bases/base32"
import * as cbor from "@ipld/dag-cbor"

import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { Action, ActionArguments, ActionContext, Env, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync, JSValue, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Config,
	Effect,
	getImmutableRecordKey,
	ModelsInit,
	ModelValue,
	parseConfig,
	validateModelValue,
} from "@canvas-js/modeldb-interface"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractStore, IPLDValue, Encoding } from "@canvas-js/store"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "./libp2p.js"
import { assert, encodeTimestampVersion, mapValues, signalInvalidType, timestampResolver } from "./utils.js"
import { concat } from "uint8arrays"
import { blake3 } from "@noble/hashes/blake3"
import { QuickJSHandle } from "quickjs-emscripten"

export interface CanvasConfig extends P2PConfig {
	contract: string
	uri?: string
	location?: string | null
	signers?: Signer[]
	offline?: boolean
	replay?: boolean
}

export type EffectContext = {
	namespace: string
	version?: string
	effects: Map<string, Effect[]>
}

type ActionInput = { name: string; args: ActionArguments; chain?: string }

type TopicHandler = {
	encoding: Encoding<IPLDValue>
	topic: string
	apply(key: Uint8Array, event: IPLDValue): Promise<{ result?: IPLDValue }>
}

type ActionAPI = Record<string, () => Promise<void>>
type CustomActionAPI = Record<string, () => Promise<void>>
type DefaultExports = { db?: AbstractModelDB; actions?: ActionAPI; customActions?: CustomActionAPI }

export class Canvas<Exports extends {} = DefaultExports> extends EventEmitter<{}> {
	public static async initialize<Exports extends {} = DefaultExports>(config: CanvasConfig): Promise<Canvas<Exports>> {
		const { uri, location = null, contract, signers = [], replay = false, offline = false } = config
		const target = getTarget(location)
		const peerId = await target.getPeerId()

		const libp2pOptions = await getLibp2pOptions(peerId, config)
		const libp2p = await createLibp2p({ ...libp2pOptions, start: false })

		if (signers.length === 0) {
			const signer = await SIWESigner.init({})
			signers.push(signer)
		}

		// Create a QuickJS VM
		const vm = await VM.initialize({})

		// Contract have access to three global synchronous functions:
		// `openDB`, `addActionHandler`, and `addCustomActionHandler`.
		// Even though these feel (to the contract) like normal functions,
		// we don't actually do anything when they're called, we just validate
		// their arguments and collect a reified version of their effects.

		const databases: { id: string; handle: QuickJSHandle; init: ModelsInit }[] = []
		const actionHandlers: { topic: string; handle: QuickJSHandle; actions: Record<string, JSFunctionAsync> }[] = []
		const customActionHandlers: { topic: string; handle: QuickJSHandle; apply: JSFunctionAsync }[] = []

		const app = new Canvas<Exports>(peerId, libp2p, signers, {} as Exports, vm)

		let topLevelExecution = false
		vm.setGlobalValues({
			openDB: vm.context.newFunction("openDB", (modelsHandle, optionsHandle) => {
				assert(topLevelExecution, "openDB can only be called during initial top-level execution")

				let name: string | null = null
				if (optionsHandle !== undefined) {
					const nameHandle = vm.context.getProp(optionsHandle, "name")
					const nameHandleType = vm.context.typeof(nameHandle)
					if (nameHandleType === "string") {
						// TODO: validate database name?
						name = nameHandle.consume(vm.context.getString)
					} else if (nameHandleType !== "string") {
						throw new TypeError("expected string in options.name")
					}
				}

				// we probably shouldn't use user-provided strings as filenames at all,
				// so here we map the name to a hashed "database id".
				const id = name === null ? "models" : `models-${base32.baseEncode(blake3(name, { dkLen: 10 }))}`

				// TODO: validate modelsInit
				const init = vm.unwrapValue(modelsHandle) as ModelsInit
				const config = parseConfig(init)

				const modelAPIs = app.getModelAPIs(id, config)
				const handle = vm.wrapObject(mapValues(modelAPIs, (api) => vm.wrapObject(mapValues(api, vm.wrapFunction))))
				databases.push({ id, handle: vm.cache(handle), init })
				return handle
			}),

			addActionHandler: vm.context.newFunction("addActionHandler", (config) => {
				assert(topLevelExecution, "addActionHandler can only be called during initial execution")
				const { topic: topicHandle, actions: actionsHandle, ...rest } = vm.unwrapObject(config)
				Object.values(rest).forEach((handle) => handle.dispose())

				const topic = topicHandle.consume(vm.context.getString)
				const actions = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) =>
					handle.consume(vm.unwrapFunctionAsync)
				)

				const result = vm.context.newObject()
				actionHandlers.push({ topic, actions, handle: vm.cache(result) })
				return result
			}),

			addCustomActionHandler: vm.context.newFunction("addCustomActionHandler", (config) => {
				assert(topLevelExecution, "addCustomActionHandler can only be called during initial execution")
				const { topic: topicHandle, apply: applyHandle, ...rest } = vm.unwrapObject(config)
				try {
					assert(topicHandle !== undefined, "missing topic in custom action handler")
					assert(applyHandle !== undefined, "missing apply method in custom action handler")
					const topic = vm.context.getString(topicHandle)
					const apply = vm.unwrapFunctionAsync(applyHandle)
					const result = vm.context.newObject()
					customActionHandlers.push({ topic, apply, handle: vm.cache(result) })
					return result
				} finally {
					topicHandle?.dispose()
					applyHandle?.dispose()
					Object.values(rest).forEach((handle) => handle.dispose())
				}
			}),
		})

		// execute the contract, collecting the handler and database effects
		let exports: QuickJSHandle | undefined = undefined
		try {
			topLevelExecution = true
			exports = await vm.import(contract, { uri })
		} finally {
			topLevelExecution = false
		}

		// now we actually create the database(s)
		for (const { id, init } of databases) {
			const db = await target.openDB(id, init, { resolve: timestampResolver })
			app.databases.set(id, db)
		}

		// TODO: this is where we'd add dynamic topic sharding.
		// right now, every handler just maps 1-to-1 to a Store instance,
		// but what we want is for each handler to map to an array of store instances.

		for (const { topic, actions } of actionHandlers) {
			const handler = app.createActionHandler(topic, actions)
			const store = await target.openStore({ libp2p, topic, encoding: handler.encoding, apply: handler.apply })
			app.stores.set(topic, store)
		}

		for (const { topic, apply } of customActionHandlers) {
			const handler = app.createCustomActionHandler(topic, apply)
			const store = await target.openStore({ libp2p, topic, encoding: handler.encoding, apply: handler.apply })
			app.stores.set(topic, store)
		}

		for (const [name, handle] of Object.entries(exports.consume(vm.unwrapObject))) {
			handle.consume((handle) => {
				// check if the handle is a database opened with `openDB`
				const database = databases.find((database) => vm.is(database.handle, handle))
				if (database !== undefined) {
					Object.assign(app.exports, { [name]: app.databases.get(database.id) })
					return
				}

				// check if the handle is an action handler created with `addActionHandler`
				const actionHandler = actionHandlers.find((handler) => vm.is(handler.handle, handle))
				if (actionHandler !== undefined) {
					Object.assign(app.exports, { [name]: {} })
					return
				}

				// check if the handle is a custom action handler created with `addCustomActionHandler`
				const customActionHandler = customActionHandlers.find((handler) => vm.is(handler.handle, handle))
				if (customActionHandler !== undefined) {
					Object.assign(app.exports, { [name]: {} })
					return
				}

				// otherwise, just dump the value
				Object.assign(app.exports, { [name]: vm.context.dump(handle) })
			})
		}

		if (!offline) {
			await libp2p.start()
		}

		return app
	}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	private readonly databases = new Map<string, AbstractModelDB>()
	private readonly stores = new Map<string, AbstractStore>()

	private constructor(
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap>,
		public readonly signers: Signer[],
		public readonly exports: Exports,
		private readonly vm: VM
	) {
		super()

		libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
			console.log(chalk.gray(`[canvas-core] Opened connection to ${peerId}`))
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			console.log(chalk.gray(`[canvas-core] Closed connection to ${peerId}`))
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})
	}

	#effectContext: EffectContext | null = null
	private logEffect(id: string, effect: Effect) {
		this.log("[%s] logging effect %o", id, effect)
		const { effects } = this.getEffectContext()
		const log = effects.get(id)
		assert(log !== undefined, "internal error - effect log not found")
		log.push(effect)
	}

	private getModelAPIs(id: string, config: Config): Record<string, Record<string, JSFunctionAsync>> {
		const modelAPIs: Record<string, Record<string, JSFunctionAsync>> = {}
		for (const model of config.models) {
			if (model.kind === "immutable") {
				const log = logger(`canvas:modeldb:${id}:${model.name}`)
				modelAPIs[model.name] = {
					add: async (value) => {
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						this.logEffect(id, { model: model.name, operation: "add", value: modelValue })
						const { namespace } = this.getEffectContext()
						const key = getImmutableRecordKey(modelValue, { namespace })
						log("returning derived record key %s", model.name, key)
						return key
					},
					get: async (key) => {
						const db = this.databases.get(id)
						assert(db !== undefined, "internal error - model database not found")
						assert(typeof key === "string", "key argument must be a string")
						return await db.get(model.name, key)
					},
				}
			} else if (model.kind === "mutable") {
				modelAPIs[model.name] = {
					set: async (key, value) => {
						assert(typeof key === "string", "key argument must be a string")
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						this.logEffect(key, { model: model.name, operation: "set", key, value: modelValue })
						return undefined // make TypeScript happy
					},
					delete: async (key) => {
						assert(typeof key === "string", "key argument must be a string")
						this.logEffect(key, { model: model.name, operation: "delete", key })
						return undefined // make TypeScript happy
					},
				}
			} else {
				signalInvalidType(model.kind)
			}
		}

		return modelAPIs
	}

	private readonly getEffectContext = () => {
		assert(this.#effectContext !== null, "effect context not set")
		return this.#effectContext
	}

	private readonly setEffectContext = (namespace: string, version?: string) => {
		assert(this.#effectContext === null, "effect context already set")
		const effects = new Map<string, Effect[]>()
		for (const id of this.databases.keys()) {
			effects.set(id, [])
		}

		this.#effectContext = { namespace, version, effects }
	}

	private readonly clearEffectContext = () => {
		assert(this.#effectContext !== null, "effect context not set")
		this.#effectContext = null
	}

	private async applyEffects() {
		const { namespace, version, effects } = this.getEffectContext()

		this.log(
			"applying %d effects",
			[...effects.values()].reduce((sum, effects) => sum + effects.length, 0)
		)

		for (const [id, log] of effects) {
			const db = this.databases.get(id)
			assert(db !== undefined, "database not found")
			await db.apply(log, { namespace, version })
		}
	}

	public async getApplicationData(): Promise<{ peerId: string }> {
		return { peerId: this.peerId.toString() }
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p.isStarted()) {
			await this.libp2p.stop()
		}

		for (const db of this.databases.values()) {
			db.close()
		}

		for (const store of this.stores.values()) {
			await store.stop()
		}

		this.vm.dispose()

		this.dispatchEvent(new Event("close"))
	}

	public async applyAction(
		topic: string,
		input: ActionInput,
		env: Env = {}
	): Promise<{ id: string; result?: IPLDValue }> {
		const signer = this.signers.find((signer) => input.chain === undefined || signer.match(input.chain))
		assert(signer !== undefined, `no signer provided for chain ${input.chain}`)

		const context: ActionContext = {
			topic: topic,
			timestamp: Date.now(),
			blockhash: null,
			// depth: 0,
			// dependencies: [],
		}

		const action = await signer.create(input.name, input.args, context, env)

		const store = this.stores.get(topic)
		assert(store !== undefined, "missing store for topic")
		const { key, result } = await store.publish(action)

		const id = base32.baseEncode(key)
		return { id, result }
	}

	private readonly actionEncoding: Encoding<IPLDValue> = {
		keyToString: (key) => {
			return base32.baseEncode(key)
		},
		encode: (event) => {
			assert(this.validateAction(event), "invalid action")
			const timestamp = encodeTimestampVersion(event.value.context.timestamp)
			const value = cbor.encode(event)
			return [concat([timestamp, blake3(value, { dkLen: 14 })]), value]
		},
		decode: (value) => {
			const event = cbor.decode(value) as IPLDValue
			assert(this.validateAction(event), "invalid action")
			const timestamp = encodeTimestampVersion(event.value.context.timestamp)
			return [concat([timestamp, blake3(value, { dkLen: 14 })]), event]
		},
	}

	private validateAction(event: IPLDValue): event is Signed<Action> {
		// TODO: do the thing
		return true
	}

	private createActionHandler(topic: string, actions: Record<string, JSFunctionAsync>): TopicHandler {
		return {
			topic: topic,
			encoding: this.actionEncoding,
			apply: async (key, event) => {
				assert(this.validateAction(event), "invalid action")

				verifySignedValue(event)

				const { chain, address, name, args, context } = event.value

				const signer = this.signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, `no signer provided for chain ${chain}`)
				await signer.verify(event)

				const id = this.actionEncoding.keyToString(key)
				const version = encodeTimestampVersion(context.timestamp)
				this.setEffectContext(id, bytesToHex(version))
				try {
					assert(actions[name] !== undefined, `invalid action name: ${name}`)
					const result = await actions[name](args, { id, chain, address, ...context })
					await this.applyEffects()
					return { result }
				} finally {
					this.clearEffectContext()
				}
			},
		}
	}

	public async applyCustomAction(topic: string, input: JSValue): Promise<{ id: string; result?: IPLDValue }> {
		const store = this.stores.get(topic)
		assert(store !== undefined, "missing store for topic")
		const { key, result, recipients } = await store.publish(input)
		const id = this.customActionEncoding.keyToString(key)
		return { id, result }
	}

	private readonly customActionEncoding: Encoding<IPLDValue> = {
		keyToString: (key) => {
			return base32.baseEncode(key)
		},
		encode: (event) => {
			assert(this.validateCustomAction(event), "invalid custom action")
			const value = cbor.encode(event)
			return [blake3(value, { dkLen: 20 }), value]
		},
		decode: (value) => {
			const event = cbor.decode(value) as IPLDValue
			assert(this.validateCustomAction(event), "invalid custom action")
			return [blake3(value, { dkLen: 20 }), event]
		},
	}

	private validateCustomAction(event: IPLDValue): event is JSValue {
		// TODO: do the thing
		return true
	}

	private createCustomActionHandler(topic: string, apply: JSFunctionAsync): TopicHandler {
		return {
			encoding: this.customActionEncoding,
			topic,
			apply: async (key, event) => {
				assert(this.validateCustomAction(event))
				const id = base32.baseEncode(key)
				this.setEffectContext(id)
				try {
					const result = await apply(event, {})
					await this.applyEffects()
					return { result }
				} finally {
					this.clearEffectContext()
				}
			},
		}
	}
}
