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

		// check for invalid keys
		for (const key of Reflect.ownKeys(Object.getPrototypeOf(this)).filter(
			(key) => typeof key !== "symbol" && key !== "constructor" && !key.startsWith("_"),
		)) {
			if (typeof key !== "symbol" && accessors.includes(key)) {
				throw new Error(`ReplicatedObject: reserved keyword ${key}`)
			}
		}

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
					const signer = instance._contextSigner
					await instance._app?.actions[name].call(instance, args, { signer })
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
				for (const explicit of explicits) {
					if (isHandlerKey(explicit) || typeof explicit === "symbol") continue
					child._tx[explicit] = async (...args: any[]) => {
						// should be Object.getPrototypeOf(Object.getPrototypeOf(instance))?
						grandparent._contextAddress = instance._address
						return grandparent[explicit]?.bind(grandparent).apply(grandparent, args)
					}
				}
			} else {
				const explicits = Reflect.ownKeys(parent).filter((key) => !accessors.includes(key))
				for (const explicit of explicits) {
					if (isHandlerKey(explicit) || typeof explicit === "symbol") continue
					child._tx[explicit] = async (...args: any[]) => {
						parent._contextAddress = instance._address
						return parent[explicit]?.bind(parent).apply(parent, args)
					}
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

				// contract to handler
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
				const child = Object.getPrototypeOf(instance)
				if (!this._tx[name]) this._tx[name] = child[name].bind(child)
			} else {
				const fn = async function (...args: any[]) {
					const signer = instance._contextSigner
					if (signer) {
						instance._contextSigner = undefined
						const result = instance._app?.actions[name].call(instance, args, { signer })
						// TODO: don't reset here, there might be multiple action calls
						instance._contextAddress = undefined
						instance._contextDid = undefined
						instance._contextPublicKey = undefined
						return result
					} else {
						return instance._app?.actions[name].call(instance, args, { signer })
					}
				}
				if (!this[name]) this[name] = fn
			}
		}

		this.as = (signer: SessionSigner<any>, signerAddress: string) => {
			// TODO: lock the object
			// TODO: better way to get the address from signers
			this._contextSigner = signer
			this._contextAddress = signerAddress
			prototypes.slice(prototypes.length - 2).map((p) => {
				p._contextSigner = signer
				p._contextAddress = signerAddress
			})
			return this
		}

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
