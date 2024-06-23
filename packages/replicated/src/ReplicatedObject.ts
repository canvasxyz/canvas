import { mkdirSync } from "fs"
import { ActionImplementation, ActionContext, Canvas, ModelAPI } from "@canvas-js/core"
import { Signer, SessionSigner, Session, Action } from "@canvas-js/interfaces"
import { ReplicatedConfig, ReplicatedObjectError, Call } from "./types.js"

export abstract class ReplicatedObject<
	T extends Record<string, Call> = any,
	K extends typeof ReplicatedObject = typeof ReplicatedObject,
> {
	#app?: Canvas
	#db?: ModelAPI
	#ready: Promise<ReplicatedObject<T, K>>

	#signers: SessionSigner[] // signers are async, so these fields aren't available in the constructor
	#address?: string
	#did?: `did:${string}`
	#publicKey?: string

	#contextSigner?: SessionSigner
	#contextAddress?: string
	#contextDid?: `did:${string}`
	#contextPublicKey?: string

	#topic?: string
	#tx: Record<string, (...args: any[]) => any>;

	[handler: `on${string}`]: (...args: any[]) => void
	[action: Exclude<string, `on${string}`>]: any

	as: (signer: SessionSigner<any>) => { [k: string]: Call }

	static db = {}

	get tx() {
		return this.#tx
	}
	get db() {
		if (this.#db === undefined) throw new Error("app not initialized")
			return this.#db
	}
	get address(): string {
		if (this.#address === undefined) throw new Error("app not initialized")
		return this.#contextAddress ?? this.#address
	}
	get did(): string {
		if (this.#did === undefined) throw new Error("app not initialized")
		return this.#contextDid ?? this.#did
	}
	get publicKey(): string {
		if (this.#publicKey === undefined) throw new Error("app not initialized")
		return this.#contextPublicKey ?? this.#publicKey
	}

	constructor(config: ReplicatedConfig = {}) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const instance = this
		const parent = Object.getPrototypeOf(this) // TODO: not parent, but root (repeat until we find a base ReplicatedObject)

		this.#signers = []
		this.#tx = {}

		// set up topic, models, and actions
		this.#topic = this.#topic ?? config.topic
		const models = (this.constructor as K).db

		if (this.#topic === undefined) throw new ReplicatedObjectError("Must define a topic on class or constructor")
		if (Object.keys(models).length === 0) throw new ReplicatedObjectError("Must define a model")

		// set up keys
		const isHandlerKey = (key: string | symbol): key is `on${string}` => {
			return typeof key === "string" && key.match(/^on[A-Z].*/) !== null
		}
		const fromHandlerKey = (key: string) => {
			return key[2].toLowerCase() + key.slice(3)
		}
		const keys = Reflect.ownKeys(Object.getPrototypeOf(this)).filter(
			(key) => key !== "constructor" && key !== "as" && key !== "_tx",
		)
		const actionHandlerKeys: `on${string}`[] = keys.filter(isHandlerKey)

		// set up contract
		const contract: { models: any; actions: Record<string, Call> } = { models, actions: {} }
		for (const handlerKey of actionHandlerKeys) {
			if (typeof handlerKey === "symbol") continue
			if (typeof (this as any)[handlerKey] !== "function") continue
			const name = fromHandlerKey(handlerKey)

			contract.actions[name] = (parentDb, parentArgs, parentContext) => {
				const context = {
					db: { set: parentDb.set, get: parentDb.get },
					...parentContext,
				}
				this[handlerKey].apply(context, parentArgs)
			}
		}

		// set up calls
		for (const key of keys) {
			const name = isHandlerKey(key) ? fromHandlerKey(key) : key
			const explicit = !isHandlerKey(key)
			if (typeof name === "symbol") continue

			if (explicit) {
				this.#tx[name] = this[name]
			} else {
				const fn = async function (...args: any[]) {
					const signer = instance.#contextSigner
					if (signer) {
						instance.#contextSigner = undefined
						const result = instance.#app?.actions[name].call(instance, args, { signer })
						instance.#contextAddress = undefined
						instance.#contextDid = undefined
						instance.#contextPublicKey = undefined
						return result
					} else {
						return instance.#app?.actions[name].call(instance, args, { signer })
					}
				}
				if (!this[name]) this[name] = fn
				this.#tx[name] = fn
			}
		}

		// set up calls with .as()
		const parentCalls: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}
		const childCalls: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}
		for (const key of keys) {
			const name = isHandlerKey(key) ? fromHandlerKey(key) : key
			const explicit = !isHandlerKey(key)
			if (typeof name === "symbol") continue
			if (explicit && typeof (this as any)[name] !== "function") continue

			if (explicit) {
				childCalls[name] = async function (signer: SessionSigner<any>, ...args: any[]) {
					// TODO: lock the object here
					let session = await signer.getSession(instance.#topic!)
					if (!session) {
						session = await signer.newSession(instance.#topic!)
					}
					instance.#contextSigner = signer
					instance.#contextAddress = signer.getAddressFromDid(session?.payload.did)
					instance.#contextDid = session.payload.did
					instance.#contextPublicKey = session.payload.publicKey
					// eslint-disable-next-line prefer-spread
					return instance[name].apply(instance, args) ?? instance.#tx[name].apply(instance, args)
				}
			} else {
				parentCalls[name] = function (signer: SessionSigner<any>, ...args: any[]) {
					return instance.#app?.actions[name].call(this, args, { signer })
				}
			}
		}

		this.as = (signer: SessionSigner<any>) => {
			const calls = { ...parentCalls, ...childCalls } // root shadows child
			return Object.fromEntries(Object.entries(calls).map(([key, call]) => [key, call.bind(instance, signer)]))
		}

		this.#ready = new Promise((resolve, reject) => {
			const app = Canvas.initialize({
				topic: this.#topic,
				contract,
			})
				.then(async (app) => {
					this.#app = app
					this.#db = app.db
					this.#signers = app.signers.getAll()
					this.#did = await this.#signers[0].getDid()
					this.#address = this.#signers[0].getAddressFromDid(this.#did)
					this.#publicKey = (await this.#signers[0].getSession(instance.#topic!, { did: this.#did }))?.payload.publicKey
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
		await this.#ready
		return this
	}

	async stop() {
		await this.#app?.stop()
	}

	get app() {
		return this.#app
	}
}
