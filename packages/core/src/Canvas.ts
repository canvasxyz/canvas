import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { logger } from "@libp2p/logger"
import { bytesToHex } from "@noble/hashes/utils"

import { Action, ActionContext, Env, Signer } from "@canvas-js/interfaces"
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
import { Store, IPLDValue, Encoding, createOrderedEncoding, createDefaultEncoding } from "@canvas-js/store"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "./libp2p.js"
// import { ActionHandler, ActionInput, CustomActionHandler } from "./handlers.js"
import { assert, encodeTimestampVersion, mapValues, signalInvalidType, timestampResolver } from "./utils.js"
import { base32 } from "multiformats/bases/base32"
import { Signed, verifySignedValue } from "@canvas-js/signed-value"
import { ActionInput } from "./handlers.js"

export interface CanvasConfig extends P2PConfig {
	contract: string
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

type TopicHandler = {
	encoding: Encoding<IPLDValue>
	topic: string
	apply(key: Uint8Array, event: IPLDValue): Promise<{ result?: IPLDValue }>
}

export class Canvas extends EventEmitter<{}> {
	public static async initialize(config: CanvasConfig) {
		const { location = null, contract, signers = [], replay = false, offline = false } = config
		const target = getTarget(location)
		const peerId = await target.getPeerId()

		const libp2pOptions = await getLibp2pOptions(peerId, config)

		let libp2p: Libp2p<ServiceMap> | null = null
		if (offline === false) {
			libp2p = await createLibp2p({ ...libp2pOptions, start: false })
		}

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
		// their arguments and collect a reified version of their effects in
		// the app.databases and app.handlers arrays.

		const databases = new Map<string, ModelsInit>()

		// the type here are an absolute mess, need to rethink it all
		// const handlers: (TopicHandler<Signed<Action>, ActionArguments> | TopicHandler<IPLDValue, JSValue>)[] = []

		const app = new Canvas(peerId, libp2p, signers, vm)

		let topLevelExecution = false
		vm.setGlobalValues({
			openDB: vm.context.newFunction("openDB", (nameHandle, modelsHandle) => {
				assert(topLevelExecution, "openDB can only be called during initial top-level execution")
				const name = vm.context.getString(nameHandle)
				if (databases.has(name)) {
					return vm.wrapError(new Error(`duplicate database name ${JSON.stringify(name)}`))
				}

				// TODO: validate modelsInit
				const init = vm.unwrapValue(modelsHandle) as ModelsInit
				const config = parseConfig(init)
				const modelAPIs = app.getModelAPIs(name, config)
				databases.set(name, init)
				return vm.wrapObject(mapValues(modelAPIs, (api) => vm.wrapObject(mapValues(api, vm.wrapFunction))))
			}),

			addActionHandler: vm.context.newFunction("addActionHandler", (config) => {
				assert(topLevelExecution, "addActionHandler can only be called during initial top-level execution")
				const { topic: topicHandle, actions: actionsHandle, ...rest } = vm.unwrapObject(config)
				Object.values(rest).forEach((handle) => handle.dispose())

				const topic = topicHandle.consume(vm.context.getString)
				const actions = mapValues(actionsHandle.consume(vm.unwrapObject), (handle) =>
					handle.consume(vm.unwrapFunctionAsync)
				)

				app.handlers.push(app.createActionHandler(topic, actions))
			}),

			addCustomActionHandler: vm.context.newFunction("addCustomActionHandler", (config) => {
				assert(topLevelExecution, "addCustomActionHandler can only be called during initial top-level execution")
				const { topic: topicHandle, apply: applyHandle, ...rest } = vm.unwrapObject(config)
				try {
					assert(topicHandle !== undefined, "missing topic in custom action handler")
					assert(applyHandle !== undefined, "missing apply method in custom action handler")
					const topic = vm.context.getString(topicHandle)
					const apply = vm.unwrapFunctionAsync(applyHandle)
					app.handlers.push(app.createCustomActionHandler(topic, apply))
				} finally {
					topicHandle?.dispose()
					applyHandle?.dispose()
					Object.values(rest).forEach((handle) => handle.dispose())
				}
			}),
		})

		// execute the contract, collecting the handler and database effects
		try {
			topLevelExecution = true
			vm.execute(contract)
		} finally {
			topLevelExecution = false
		}

		// now we actually create the database(s)
		for (const [name, init] of databases) {
			const db = await target.openDB(name, init, { resolve: timestampResolver })
			app.dbs.set(name, db)
		}

		if (libp2p !== null) {
			await libp2p.start()
		}

		// TODO: this is where we'd add dynamic topic sharding.
		// right now, every handler just maps 1-to-1 to a Store instance,
		// but what we want is for each handler to map to an array of store instances.
		if (libp2p !== null) {
			for (const { topic, encoding, apply } of app.handlers) {
				const store = await target.openStore({ libp2p, topic, encoding, apply })
				app.stores.set(topic, store)
			}
		}

		return app
	}

	// private readonly handlers: TopicHandler[] = []
	private readonly handlers: {
		topic: string
		apply: (key: Uint8Array, event: IPLDValue) => Promise<{ result?: IPLDValue }>
		encoding: Encoding<IPLDValue>
	}[] = []

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	readonly dbs = new Map<string, AbstractModelDB>()
	readonly stores = new Map<string, Store>()

	private constructor(
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly signers: Signer[],
		private readonly vm: VM
	) {
		super()

		libp2p?.addEventListener("peer:connect", ({ detail: peerId }) => {
			console.log(chalk.gray(`[canvas-core] Opened connection to ${peerId}`))
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		libp2p?.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			console.log(chalk.gray(`[canvas-core] Closed connection to ${peerId}`))
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})
	}

	#effectContext: EffectContext | null = null
	private logEffect(name: string, effect: Effect) {
		this.log("[%s] logging effect %o", name, effect)
		const { effects } = this.getEffectContext()
		const log = effects.get(name)
		assert(log !== undefined, "internal error - effect log not found")
		this.log("log.push(effect)")
		log.push(effect)
	}

	private getModelAPIs(name: string, config: Config): Record<string, Record<string, JSFunctionAsync>> {
		const modelAPIs: Record<string, Record<string, JSFunctionAsync>> = {}
		for (const model of config.models) {
			if (model.kind === "immutable") {
				const log = logger(`canvas:modeldb:${name}:${model.name}`)
				modelAPIs[model.name] = {
					add: async (value) => {
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						this.logEffect(name, { model: model.name, operation: "add", value: modelValue })
						const { namespace } = this.getEffectContext()
						const key = getImmutableRecordKey(modelValue, { namespace })
						log("returning derived record key %s", model.name, key)
						return key
					},
					get: async (key) => {
						const db = this.dbs.get(name)
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
						this.logEffect(name, { model: model.name, operation: "set", key, value: modelValue })
						return undefined // make TypeScript happy
					},
					delete: async (key) => {
						assert(typeof key === "string", "key argument must be a string")
						this.logEffect(name, { model: model.name, operation: "delete", key })
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
		for (const name of this.dbs.keys()) {
			effects.set(name, [])
		}

		this.#effectContext = { namespace, version, effects }
	}

	private readonly clearEffectContext = () => {
		assert(this.#effectContext !== null, "effect context not set")
		this.#effectContext = null
	}

	private async applyEffects() {
		const { namespace, version, effects } = this.getEffectContext()
		for (const [name, log] of effects) {
			const db = this.dbs.get(name)
			assert(db !== undefined, "unknown database name")
			await db.apply(log, { namespace, version })
		}
	}

	public async getApplicationData(): Promise<{ peerId: string }> {
		return { peerId: this.peerId.toString() }
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null) {
			await this.libp2p.stop()
		}

		for (const db of this.dbs.values()) {
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

	private readonly actionEncoding = createOrderedEncoding<IPLDValue>({
		prefixByteLength: 6,
		getPrefix: (event) => {
			assert(this.validateAction(event), "invalid action")
			return encodeTimestampVersion(event.value.context.timestamp)
		},
	})

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

				assert(actions[name] !== undefined, `invalid action name: ${name}`)

				const version = encodeTimestampVersion(context.timestamp)

				const id = base32.baseEncode(key)
				this.setEffectContext(id, bytesToHex(version))
				try {
					const result = await actions[name](args, { id, chain, address, ...context })
					await this.applyEffects()
					return { result }
				} finally {
					this.clearEffectContext()
				}
			},
		}
	}

	public async applyCustomAction(
		topic: string,
		input: JSValue,
		env: Env = {}
	): Promise<{ id: string; result?: IPLDValue }> {
		const store = this.stores.get(topic)
		assert(store !== undefined, "missing store for topic")

		const { key, result, recipients } = await store.publish(input)

		const id = base32.baseEncode(key)
		return { id, result }
	}

	private readonly customActionEncoding = createDefaultEncoding()

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
