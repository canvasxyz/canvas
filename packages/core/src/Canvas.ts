import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { CBORValue } from "microcbor"

import { Env, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Config,
	Effect,
	getImmutableRecordKey,
	ModelsInit,
	ModelValue,
	parseConfig,
	Resolve,
	validateModelValue,
} from "@canvas-js/modeldb-interface"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Store } from "@canvas-js/store"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "./libp2p.js"
import { ActionHandler, ActionInput, CustomActionHandler, TopicHandler } from "./handlers.js"
import { assert, compareTimestampVersion, mapValues, signalInvalidType } from "./utils.js"

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

export class Canvas extends EventEmitter<{}> {
	public static async initialize(config: CanvasConfig) {
		const { location = null, contract, signers = [], replay = false, offline = false } = config
		const target = getTarget(location)
		const peerId = await target.getPeerId()
		console.log("[canvas-core]", chalk.bold(`Using PeerId ${peerId}`))

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
		const handlers: TopicHandler[] = []

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

				const handler = new ActionHandler(topic, actions, app.signers)
				handlers.push(handler)
			}),

			addCustomActionHandler: vm.context.newFunction("addCustomActionHandler", (config) => {
				assert(topLevelExecution, "addCustomActionHandler can only be called during initial top-level execution")
				const { topic: topicHandle, apply: applyHandle, ...rest } = vm.unwrapObject(config)
				Object.values(rest).forEach((handle) => handle.dispose())

				const topic = topicHandle.consume(vm.context.getString)
				const apply = applyHandle.consume(vm.unwrapFunctionAsync)

				const handler = new CustomActionHandler(topic, apply)
				handlers.push(handler)
			}),
		})

		// execute the contract, collecting the handler and database effects
		try {
			topLevelExecution = true
			vm.execute(contract)
		} finally {
			topLevelExecution = false
		}

		{
			// now we actually create the database(s)
			const resolve: Resolve = {
				lessThan: (a, b) => compareTimestampVersion(a.version, b.version) === -1,
			}

			for (const [name, init] of databases) {
				const db = await target.openDB(name, init, { resolve })
				app.dbs.set(name, db)
			}
		}

		// if (config.replay) {
		// 	console.log(`[canvas-core] Replaying action log...`)
		// 	let i = 0
		// 	for await (const [id, message] of messageStore.getMessageStream()) {
		// 		if (message.type === "action") {
		// 			assert(actionType.is(message), "Invalid action object in message store")
		// 			const effects = await vm.execute(id, message.payload)
		// 			await modelStore.applyEffects(message.payload, effects)
		// 			i++
		// 		}
		// 	}

		// 	console.log("[canvas-core]", chalk.green(`Successfully replayed all ${i} actions from the message store.`))
		// }

		if (libp2p !== null) {
			await libp2p.start()
			// libp2p.services.pubsub.subscribe(PUBSUB_DISCOVERY_TOPIC)
			// await Promise.all(Object.values(core.sources).map((source) => source.start()))
		}

		return app
	}

	// /**
	//  * const app = await Canvas.init({ ... })
	//  * app.subscribe("/interwallet/room/12nk1291", )
	//  */
	// public setEnvironmentVariable(name: string, value: string) {}

	private readonly handlers: TopicHandler[] = []
	private readonly stores: Map<string, Store<CBORValue>> = new Map()
	private readonly controller = new AbortController()
	private readonly dbs = new Map<string, AbstractModelDB>()

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

		// const globalAPI: API = {
		// 	addActionHandler: (init) => {
		// 		assert(topLevelExecution, "addActionHandler can only be called during initial contract execution")
		// 		assert(isObject(init), "init argument must be an object")
		// 		assert(typeof init.topic === "string", "init.topic must be a string")
		// 		assert(isObject(init.actions), "init.actions must be an object")

		// 		const actions = mapEntries(init.actions, (_, action) => {
		// 			assert(typeof action === "function", "action values must be functions")
		// 			const handler: ActionFunction = async (id, event, env) => {
		// 				this.setEffectContext(id, encodeTimestampVersion(event.value.context.timestamp))
		// 				try {
		// 					const { chain, address } = event.value
		// 					const { topic, timestamp } = event.value.context
		// 					const ctx = { id, topic, timestamp, chain, address, env }
		// 					const result = await action(event.value.args, ctx)
		// 					await this.applyEffects()
		// 					return result
		// 				} finally {
		// 					this.#effectContext = null
		// 				}
		// 			}

		// 			return handler
		// 		})

		// 		const subscription = new ActionHandler(init.topic, this.signers, actions)
		// 		this.subscriptions.push(subscription)
		// 	},

		// 	addCustomActionHandler: (init) => {
		// 		assert(topLevelExecution, "addCustomActionHandler can only be called during initial contract execution")
		// 		assert(isObject(init), "init argument must be an object")
		// 		assert(typeof init.topic === "string", "init.topic must be a string")
		// 		assert(typeof init.apply === "function", "init.apply must be a function")

		// const subscription = new CustomActionHandler(init.topic, init.apply)
		// this.subscriptions.push(subscription)
		// 	},

		// for (const subscription of this.subscriptions) {
		// 	const store = await Store .init({
		// 		topic: subscription.topic,
		// 		libp2p,
		// 	})

		// 	store.addConsumer(async (event) => {
		// 		await subscription.validate(event)
		// 		await subscription.apply(event)
		// 	})

		// 	await store.start()
		// }

		// TODO: create stores for each of the subscriptions
	}

	#effectContext: EffectContext | null = null
	private logEffect(name: string, effect: Effect) {
		const { effects } = this.getEffectContext()
		const log = effects.get(name)
		assert(log !== undefined, "internal error - effect log not found")
		log.push(effect)
	}

	private getModelAPIs(name: string, config: Config): Record<string, Record<string, JSFunctionAsync>> {
		const modelAPIs: Record<string, Record<string, JSFunctionAsync>> = {}
		for (const model of config.models) {
			if (model.kind === "immutable") {
				modelAPIs[model.name] = {
					add: async (value) => {
						const modelValue = value as ModelValue
						validateModelValue(model, modelValue)
						this.logEffect(name, { model: model.name, operation: "add", value: modelValue })

						const { namespace } = this.getEffectContext()
						return getImmutableRecordKey(modelValue, { namespace })
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
					},
					delete: async (key) => {
						assert(typeof key === "string", "key argument must be a string")
						this.logEffect(name, { model: model.name, operation: "delete", key })
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

		// for (const store of this.stores) {

		// }

		this.vm.dispose()

		this.dispatchEvent(new Event("close"))
	}

	public async applyAction(
		topic: string,
		input: ActionInput,
		env: Env = {}
	): Promise<{ id: string; result: CBORValue }> {
		const handler = this.handlers.find((subscription) => subscription.topic === topic)
		assert(handler !== undefined, "no subscription found for topic")
		const action = await handler.create(input, env)

		throw new Error("not implemented")
	}

	public applyCustomAction(topic: string, value: CBORValue): Promise<{ id: string; result: CBORValue | null }> {
		// ...
		throw new Error("not implemented")
	}
}
