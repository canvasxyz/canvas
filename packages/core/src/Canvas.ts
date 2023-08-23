import chalk from "chalk"
import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import { logger } from "@libp2p/logger"
import { base32 } from "multiformats/bases/base32"
import { blake3 } from "@noble/hashes/blake3"
import { sha256 } from "@noble/hashes/sha256"

import { QuickJSHandle } from "quickjs-emscripten"

import { Action, ActionArguments, ActionContext, Env, IPLDValue, Signer } from "@canvas-js/interfaces"
import { JSFunctionAsync, JSValue, VM } from "@canvas-js/vm"
import {
	AbstractModelDB,
	Effect,
	getImmutableRecordKey,
	Model,
	ModelsInit,
	Resolve,
} from "@canvas-js/modeldb-interface"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { GossipLog, gossiplog, GossipLogConsumer, GossipLogInit } from "@canvas-js/libp2p-gossiplog"

import getTarget from "#target"

import { getLibp2pOptions, P2PConfig, ServiceMap } from "./libp2p.js"
import { assert, mapEntries, mapValues } from "./utils.js"

export interface CanvasConfig extends P2PConfig {
	contract: string
	uri?: string
	location?: string | null
	signers?: Signer[]
	offline?: boolean
	replay?: boolean
}

export type ActionAPI = Record<
	string,
	(
		args: ActionArguments,
		options?: { chain?: string }
	) => Promise<{ key: Uint8Array; result: void | JSValue; recipients: Promise<PeerId[]> }>
>

export class Canvas extends EventEmitter<{}> {
	public static async initialize(config: CanvasConfig): Promise<Canvas> {
		const { contract, signers = [], replay = false, offline = false } = config
		const location = config.location ?? null
		const uri = config.uri ?? `canvas:${sha256(contract)}`

		const target = getTarget(location)

		if (signers.length === 0) {
			const signer = await SIWESigner.init({})
			signers.push(signer)
		}

		// Create a QuickJS VM
		const vm = await VM.initialize({})

		// We only have two exports: `models` and `actions`.
		const {
			models: modelsHandle,
			actions: actionsHandle,
			...rest
		} = await vm.import(contract).then((handle) => handle.consume(vm.unwrapObject))

		for (const [name, handle] of Object.entries(rest)) {
			console.warn(`Extraneous export ${JSON.stringify(name)}`)
			handle.dispose()
		}

		// TODO: validate that models satisfies ModelsInit
		const models = modelsHandle.consume(vm.context.dump) as ModelsInit

		// our version strings always sort lexicographically
		const resolve: Resolve = { lessThan: (a, b) => a < b }
		const db = await target.openDB(uri, models, { resolve })

		// { [topic]: { [name]: handler } }
		const actionHandlers: Record<string, Record<string, QuickJSHandle>> = {}

		// // { [topic]: handler }
		// const customActionHandlers: Record<string, JSFunctionAsync> = {}

		// unwrap actions
		for (const [name, handle] of Object.entries(actionsHandle.consume(vm.unwrapObject))) {
			// We support several action definition formats. The simplest is just a function.
			if (vm.context.typeof(handle) === "function") {
				const topic = uri
				if (actionHandlers[topic] === undefined) {
					actionHandlers[topic] = {}
				}

				actionHandlers[topic][name] = handle.consume(vm.cache)
			} else {
				throw new Error("not implemented")
			}
		}

		// actionMap maps action names to *service IDs*,
		// which is needed to look them up from the libp2p peer.
		type ServiceId = `log-${string}`
		const actionMap: Record<string, { topic: string; serviceId: ServiceId }> = {}

		const initMap: Record<ServiceId, GossipLogInit<Action, JSValue | void>> = {}

		const databaseAPI = new DatabaseAPI(vm, db)

		for (const [topic, actions] of Object.entries(actionHandlers)) {
			const hash = blake3(topic, { dkLen: 10 })
			const serviceId = `log-${base32.baseEncode(hash)}` satisfies ServiceId
			const serviceLocation = location && `${location}/${serviceId}`

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
			initMap[serviceId] = { topic, location: serviceLocation, apply }
			for (const name of Object.keys(actions)) {
				actionMap[name] = { topic, serviceId }
			}
		}

		const peerId = await target.getPeerId()
		const { services, ...libp2pOptions } = await getLibp2pOptions(peerId, config)
		const libp2p = await createLibp2p<ServiceMap & Record<ServiceId, GossipLog<Action, JSValue | void>>>({
			...libp2pOptions,
			start: false,
			services: { ...services, ...mapValues(initMap, gossiplog) },
		})

		const actions: ActionAPI = mapEntries(actionMap, ([actionName, { topic, serviceId }]) => {
			const service = libp2p.services[serviceId]
			assert(service instanceof GossipLog, "service not found")
			return async (args: ActionArguments, { chain }: { chain?: string } = {}) => {
				const signer = signers.find((signer) => chain === undefined || signer.match(chain))
				assert(signer !== undefined, "signer not found")
				const context: ActionContext = { topic, timestamp: Date.now(), blockhash: null }
				const action = signer.create(actionName, args, context, {})
				const message = await service.create(action)
				const signature = await signer.sign(message)
				const { key, result, recipients } = await service.publish(signature, message)
				return { key, result, recipients }
			}
		})

		const app = new Canvas(signers, peerId, libp2p, vm, db, actions)

		if (!offline) {
			await libp2p.start()
		}

		return app
	}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	private constructor(
		public readonly signers: Signer[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap>,
		public readonly vm: VM,
		public readonly db: AbstractModelDB,
		public readonly actions: ActionAPI
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

	public async getApplicationData(): Promise<{ peerId: string }> {
		return { peerId: this.peerId.toString() }
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p.isStarted()) {
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

				// TODO: use `model` to unwrap valueHandle by hand
				const value = this.vm.context.dump(valueHandle)
				this.#effects.push({ model: model.name, operation: "add", value })

				return this.vm.context.newString(getImmutableRecordKey(value, {}))
			}),
			set: this.vm.context.newFunction(`db.${model.name}.set`, (keyHandle, valueHandle) => {
				assert(this.#effects !== null, "internal error")

				if (model.kind === "immutable") {
					throw new Error("cannot .set(...) immutable models - use .add(...)")
				}

				// TODO: use `model` to unwrap valueHandle by hand
				const key = this.vm.context.getString(keyHandle)
				const value = this.vm.context.dump(valueHandle)
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
}
