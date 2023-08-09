import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { CBORValue } from "microcbor"

import { QuickJSWASMModule, getQuickJS } from "quickjs-emscripten"

import { Env, Signer } from "@canvas-js/interfaces"
import { API, VM, isObject, mapEntries } from "@canvas-js/vm"
import { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb-interface"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Store } from "@canvas-js/store"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "@canvas-js/core/components/libp2p"
import { assert, compareTimestampVersion, encodeTimestampVersion, signalInvalidType } from "@canvas-js/core/utils"

import {
	ActionFunction,
	ActionHandler,
	ActionInput,
	CustomActionHandler,
	EffectContext,
	Subscription,
	getModelAPIs,
} from "./handlers.js"
import { PlatformTarget } from "./targets/interface.js"

export interface CanvasConfig extends P2PConfig {
	// pass `null` to run in memory (NodeJS only)
	contract: string
	location?: string | null
	signers?: Signer[]
	offline?: boolean
	replay?: boolean
}

export class Canvas extends EventEmitter<{}> {
	public static async initialize(config: CanvasConfig) {
		const { location = null, contract, signers = [], replay = false, offline = false } = config
		const target = getTarget(location)
		const peerId = await target.getPeerId()
		console.log("[canvas-core]", chalk.bold(`Using PeerId ${peerId}`))

		const quickJS = await getQuickJS()

		// get p2p config
		const { listen, announce, bootstrapList, minConnections, maxConnections } = config
		const libp2pOptions = await getLibp2pOptions(peerId, {
			listen,
			announce,
			bootstrapList,
			minConnections,
			maxConnections,
		})

		let libp2p: Libp2p<ServiceMap> | null = null
		if (offline === false) {
			libp2p = await createLibp2p({ ...libp2pOptions, start: false })
		}

		if (signers.length === 0) {
			const signer = await SIWESigner.init({})
			signers.push(signer)
		}

		const canvas = new Canvas(peerId, libp2p, signers, contract, target, quickJS)

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

		return canvas
	}

	private readonly vm: VM
	private readonly dbs: Map<string, AbstractModelDB> = new Map()
	private readonly subscriptions: Subscription[] = []
	private readonly stores: Map<string, Store<CBORValue>> = new Map()
	private readonly controller = new AbortController()

	private constructor(
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly signers: Signer[],
		contract: string,
		target: PlatformTarget,
		quickJS: QuickJSWASMModule
	) {
		super()

		// libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
		// 	console.log(chalk.gray(`[canvas-core] Opened connection to ${peerId}`))
		// 	this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		// })

		// libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
		// 	console.log(chalk.gray(`[canvas-core] Closed connection to ${peerId}`))
		// 	this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		// })

		const resolve = (versionA: string, versionB: string) =>
			compareTimestampVersion(versionA, versionB) === -1 ? versionA : versionB

		let topLevelExecution = false

		// const target =

		const globalAPI: API = {
			openDB: async (name, models) => {
				assert(topLevelExecution, "openDB can only be called during initial contract execution")
				assert(typeof name === "string", "name argument must be a string")
				assert(isObject(models), "models argument must be an object")
				const db = await target.openDB(name, models as ModelsInit, { resolve })
				// const db = new ModelDB(dbPath, models as ModelsInit, { resolve })
				this.dbs.set(name, db)
				return getModelAPIs(name, db, () => {
					assert(this.#effectContext !== null, "effect context not set")
					return this.#effectContext
				})
			},

			addActionHandler: (init) => {
				assert(topLevelExecution, "addActionHandler can only be called during initial contract execution")
				assert(isObject(init), "init argument must be an object")
				assert(typeof init.topic === "string", "init.topic must be a string")
				assert(isObject(init.actions), "init.actions must be an object")

				const actions = mapEntries(init.actions, (_, action) => {
					assert(typeof action === "function", "action values must be functions")
					const handler: ActionFunction = async (id, event, env) => {
						this.setEffectContext(id, encodeTimestampVersion(event.value.context.timestamp))
						try {
							const { chain, address } = event.value
							const { topic, timestamp } = event.value.context
							const ctx = { id, topic, timestamp, chain, address, env }
							const result = await action(event.value.args, ctx)
							await this.applyEffects()
							return result
						} finally {
							this.#effectContext = null
						}
					}

					return handler
				})

				const subscription = new ActionHandler(init.topic, this.signers, actions)
				this.subscriptions.push(subscription)
			},

			addCustomActionHandler: (init) => {
				assert(topLevelExecution, "addCustomActionHandler can only be called during initial contract execution")
				assert(isObject(init), "init argument must be an object")
				assert(typeof init.topic === "string", "init.topic must be a string")
				assert(typeof init.apply === "function", "init.apply must be a function")

				const subscription = new CustomActionHandler(init.topic, init.apply)
				this.subscriptions.push(subscription)
			},

			console: { log: (...args) => console.log("[canvas-vm]", ...args) },
			assert: (condition, message) => {
				assert(typeof condition === "boolean", "condition argument must be a boolean")
				assert(typeof message === "string" || message === undefined, "message argument must be a string")
				assert(condition, message)
			},
			// fetch: async (url) => {
			// 	assert(typeof url === "string", "fetch url must be a string")
			// 	return await fetch(url).then((res) => res.text())
			// },
		}

		try {
			topLevelExecution = true
			this.vm = new VM({ contract, globalAPI, quickJS })
		} finally {
			topLevelExecution = false
		}
	}

	#effectContext: EffectContext | null = null

	private readonly getEffectContext = () => {
		assert(this.#effectContext !== null, "effect context not set")
		return this.#effectContext
	}

	private readonly setEffectContext = (namespace: string, version?: string) => {
		assert(this.#effectContext === null, "effect context already set")
		this.#effectContext = { namespace, version, effects: [] }
	}

	private async applyEffects() {
		const { namespace, version, effects } = this.getEffectContext()
		for (const effect of effects) {
			const db = this.dbs.get(effect.name)
			assert(db !== undefined, "unknown database name")
			if (effect.operation === "add") {
				const key = await db.add(effect.model, effect.value, { namespace })
				assert(key === effect.key, "derived model keys did not match")
			} else if (effect.operation === "set") {
				assert(version !== undefined, "cannot `set` mutable model records from a custom action")
				await db.set(effect.model, effect.key, effect.value, { version })
			} else if (effect.operation === "delete") {
				assert(version !== undefined, "cannot `delete` mutable model records from a custom action")
				await db.delete(effect.model, effect.key, { version })
			} else {
				signalInvalidType(effect)
			}
		}
	}

	public async getApplicationData(): Promise<{ peerId: string; uri: string }> {
		return { peerId: this.peerId.toString(), uri: this.vm.uri }
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
	): Promise<{ id: string; result: CBORValue | null }> {
		const handler = this.subscriptions.find((subscription) => subscription.topic === topic)
		assert(handler !== undefined, "no subscription found for topic")
		const action = await handler.create(input, env)

		throw new Error("not implemented")
	}

	public applyCustomAction(topic: string, value: CBORValue): Promise<{ id: string; result: CBORValue | null }> {
		// ...
		throw new Error("not implemented")
	}
}
