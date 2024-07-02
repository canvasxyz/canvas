/* eslint-disable prefer-spread, @typescript-eslint/no-this-alias */
import { Canvas, ModelAPI } from "@canvas-js/core"
import { Awaitable, SessionSigner } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"

export class ReplicatedConfig {
	topic?: string
	signers?: SessionSigner[]
}

export type AnyCall = (...args: any[]) => Awaitable<any>

type Contract = { models: any; actions: Record<string, AnyCall> }

const accessors: Array<string | symbol> = [
	"constructor",
	"_tx",
	"tx",
	"db",
	"address",
	"did",
	"publicKey",
	"ready",
	"stop",
	"app",
	"as",
]

/**
 * Replicated object base.
 */
export abstract class ReplicatedObject<
	Actions extends Record<string, AnyCall> = any,
	Class extends typeof ReplicatedObject = typeof ReplicatedObject,
> {
	static db = {};
	[handler: `on${string}`]: (...args: any[]) => void
	[action: Exclude<string, `on${string}`>]: any

	// private fields only available after async initialization is completed
	_app?: Canvas
	_db?: ModelAPI
	_topic?: string
	_address?: string
	_did?: `did:${string}`
	_publicKey?: string
	_signers: SessionSigner[] // async unless provided in ReplicatedConfig
	_ready: Promise<ReplicatedObject<Actions, Class>>

	get db() {
		if (this._db === undefined) throw new Error("app not initialized")
		return this._db
	}

	get tx() {
		return this._tx
	}

	// temporary variables for signer-locked calls
	_contextSigner?: SessionSigner
	_contextAddress?: string
	_contextDid?: `did:${string}`
	_contextPublicKey?: string

	get address(): string {
		const result = this._contextAddress ?? this._address
		if (result === undefined) throw new Error("app not initialized")
		return result
	}
	get did(): string {
		const result = this._contextDid ?? this._did
		if (result === undefined) throw new Error("app not initialized")
		return result
	}
	get publicKey(): string {
		const result = this._contextPublicKey ?? this._publicKey
		if (result === undefined) throw new Error("app not initialized")
		return result
	}

	constructor(config: ReplicatedConfig = {}) {
		const instance = this

		// helpers
		const isHandlerKey = (key: string | symbol): key is `on${string}` => {
			return typeof key === "string" && key.match(/^on[A-Z].*/) !== null
		}
		const fromHandlerKey = (key: string) => {
			return key[2].toLowerCase() + key.slice(3)
		}

		// setup
		this._signers = config.signers ?? [new SIWESigner()]
		this._topic = this._topic ?? config.topic
		const models = (this.constructor as Class).db
		if (this._topic === undefined) throw new Error("must define a topic on class or constructor")
		if (Object.keys(models).length === 0) throw new Error("must define a model")

		// precompute prototype chain
		const prototypes = [instance]
		let proto = instance
		while (Object.getPrototypeOf(proto) instanceof ReplicatedObject) {
			proto = Object.getPrototypeOf(proto)
			prototypes.push(proto)
		}
		prototypes.push(Object.getPrototypeOf(proto))

		// precompute implicit dispatches: for each `onAction`, create `action`
		const implicitKeys = prototypes.slice(1).flatMap((proto) => {
			return Reflect.ownKeys(proto)
				.filter((key) => key !== "constructor" && key !== "as" && key !== "_tx")
				.filter(isHandlerKey)
				.map(fromHandlerKey)
		})
		const implicitCalls: Record<string, AnyCall> = Object.fromEntries(
			implicitKeys.map((name) => {
				async function fn(...args: any[]) {
					await instance._app?.actions[name].call(instance, args)
				}
				return [name, fn]
			}),
		)

		// add dispatches to each level in the prototype chain
		//
		// [child = this, parent = Child]
		// [child = Child, parent = Parent]
		// [child = Parent, parent = RepObj]
		for (let i = 0; i <= prototypes.length - 2; i++) {
			const child = prototypes[i]
			const parent = prototypes[i + 1]
			child._tx = {}

			for (const [implicit, fn] of Object.entries(implicitCalls)) {
				child._tx[implicit] = fn.bind(parent)
			}

			if (!Reflect.ownKeys(child).includes("constructor")) {
				const grandparent = Object.getPrototypeOf(parent)
				const explicits = Reflect.ownKeys(grandparent).filter((key) => !accessors.includes(key))
				for (let explicit of explicits) {
					if (isHandlerKey(explicit) || typeof explicit === "symbol") continue
					child._tx[explicit] = (thing: any) => {
						Object.getPrototypeOf(Object.getPrototypeOf(instance))._contextAddress = instance._address
						return grandparent[explicit]?.bind(grandparent)(thing)
					}
				}
			} else {
				const explicits = Reflect.ownKeys(parent).filter((key) => !accessors.includes(key))
				for (let explicit of explicits) {
					if (isHandlerKey(explicit) || typeof explicit === "symbol") continue
					child._tx[explicit] = parent[explicit]?.bind(parent)
				}
			}
		}

		// add contract calls to each level in the prototype chain
		const contract: Contract = { models, actions: {} }
		for (let i = 0; i <= prototypes.length - 2; i++) {
			const child = prototypes[i]
			const parent = prototypes[i + 1]

			const handlerKeys: `on${string}`[] = Reflect.ownKeys(Object.getPrototypeOf(child))
				.filter((key) => !accessors.includes(key))
				.filter(isHandlerKey)

			for (const handlerKey of handlerKeys) {
				if (typeof handlerKey === "symbol") continue
				if (typeof (this as any)[handlerKey] !== "function") continue
				const name = fromHandlerKey(handlerKey)

				contract.actions[name] = async (parentDb, parentArgs, parentContext) => {
					const context = {
						db: { set: parentDb.set, get: parentDb.get },
						...parentContext,
					}
					await this[handlerKey].apply(context, parentArgs)
				}
			}
		}

		// set up external calls
		const keys = Reflect.ownKeys(Object.getPrototypeOf(instance)).filter((key) => !accessors.includes(key))
		for (const key of keys) {
			const name = isHandlerKey(key) ? fromHandlerKey(key) : key
			const explicit = !isHandlerKey(key)
			if (typeof name === "symbol") continue

			if (explicit) {
				// TODO: remove unnecessary rebinding
				const inner = Object.getPrototypeOf(instance)
				const fn = async function (fn: AnyCall, ...args: any[]) {
					Object.getPrototypeOf(Object.getPrototypeOf(instance))._contextAddress = "123" // TODO
					await fn.apply(inner, args)
				}
				const child = Object.getPrototypeOf(instance)
				const parent = Object.getPrototypeOf(child)
				if (!this._tx[name]) {
					this._tx[name] = fn.bind(null, child[name].bind(child))
				}
			} else {
				const fn = async function (...args: any[]) {
					const signer = instance._contextSigner
					if (signer) {
						instance._contextSigner = undefined
						const result = instance._app?.actions[name].call(instance, args, { signer })
						instance._contextAddress = undefined
						instance._contextDid = undefined
						instance._contextPublicKey = undefined
						return result
					} else {
						return instance._app?.actions[name].call(instance, args, { signer })
					}
				}
				if (!this[name]) this[name] = fn
				// this._tx[name] = fn
			}
		}

		// // set up signer-locked calls
		// const implicitCalls: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}
		// const explicitCalls: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}
		// for (const key of keys) {
		// 	const name = isHandlerKey(key) ? fromHandlerKey(key) : key
		// 	const explicit = !isHandlerKey(key)
		// 	if (typeof name === "symbol") continue
		// 	if (explicit && typeof (this as any)[name] !== "function") continue

		// 	if (explicit) {
		// 		explicitCalls[name] = async function (signer: SessionSigner<any>, ...args: any[]) {
		// 			// TODO: lock the object here
		// 			let session = await signer.getSession(instance._topic!)
		// 			if (!session) {
		// 				session = await signer.newSession(instance._topic!)
		// 			}
		// 			instance._contextSigner = signer
		// 			instance._contextAddress = signer.getAddressFromDid(session?.payload.did)
		// 			instance._contextDid = session.payload.did
		// 			instance._contextPublicKey = session.payload.publicKey
		// 			return instance[name].apply(instance, args) ?? instance._tx[name].apply(instance, args)
		// 		}
		// 	} else {
		// 		implicitCalls[name] = function (signer: SessionSigner<any>, ...args: any[]) {
		// 			return instance._app?.actions[name].call(this, args, { signer })
		// 		}
		// 	}
		// }

		// this.as = (signer: SessionSigner<any>) => {
		// 	const calls = { ...implicitCalls, ...explicitCalls } // explicit overwrites implicit
		// 	return Object.fromEntries(Object.entries(calls).map(([key, call]) => [key, call.bind(instance, signer)]))
		// }

		this._ready = new Promise((resolve, reject) => {
			Canvas.initialize({
				topic: this._topic,
				contract,
				signers: this._signers,
			})
				.then(async (app) => {
					this._app = app
					this._db = app.db
					this._signers = app.signers.getAll()
					this._did = await this._signers[0].getDid()
					this._address = this._signers[0].getAddressFromDid(this._did)
					this._publicKey = (await this._signers[0].getSession(instance._topic!, { did: this._did }))?.payload.publicKey
					resolve(instance)
				})
				.catch((err) => {
					reject(err)
				})
		})
	}

	// Shorthand for `const instance = new Instance(); await instance.ready()`
	static async initialize<R extends ReplicatedObject>(
		this: { new (config?: ReplicatedConfig): R },
		config: ReplicatedConfig = {},
	) {
		const instance = new this(config)
		await instance.ready()
		return instance
	}

	async ready() {
		await this._ready
		return this
	}

	async stop() {
		await this._app?.stop()
	}

	get app() {
		return this._app
	}
}
