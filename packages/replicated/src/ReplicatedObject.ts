import { mkdirSync } from "fs"
import { ActionImplementation, ActionContext, Canvas, ModelAPI } from "@canvas-js/core"
import { Signer, SessionSigner, Session, Action } from "@canvas-js/interfaces"
import { ReplicatedConfig, ReplicatedObjectError, Call } from "./types.js"

export abstract class ReplicatedObject<
	T extends Record<string, Call> = any,
	K extends typeof ReplicatedObject = typeof ReplicatedObject,
> {
	#app: Canvas | null
	#ready: Promise<ReplicatedObject<T, K>>
	#contextSigner?: SessionSigner<any>

	topic?: string;

	[handler: `on${string}`]: (...args: any[]) => void

	as: (signer: SessionSigner<any>) => { [k: string]: Call }

	_tx: { [K in keyof T]: T[K] }
	get tx() {
		return this._tx ?? Object.getPrototypeOf(this)._tx
	}

	static db = {}

	// Stubs for action handlers to read from `this`. Action handlers
	// are always provided a context when called so these are never used
	get db(): ModelAPI {
		throw "Unexpected"
	}
	get id(): ActionContext["id"] {
		throw "Unexpected"
	}
	get address(): ActionContext["address"] {
		throw "Unexpected"
	}
	get timestamp(): ActionContext["timestamp"] {
		throw "Unexpected"
	}
	get blockhash(): ActionContext["blockhash"] {
		throw "Unexpected"
	}
	get publicKey(): ActionContext["publicKey"] {
		throw "Unexpected"
	}

	constructor(config: ReplicatedConfig = {}) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const instance = this
		const parent = Object.getPrototypeOf(this) // TODO: not parent, but root (repeat until we find a base ReplicatedObject)

		this.#app = null

		// set up topic, models, and actions
		this.topic = this.topic ?? config.topic
		const models = (this.constructor as K).db

		if (this.topic === undefined) throw new ReplicatedObjectError("Must define a topic on class or constructor")
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
		// explicitly defined calls (this.message()) go on child
		// implicitly defined calls (this.onMessage()) go on root
		const rootCalls: Record<string, ActionImplementation<any>> = {}
		const childCalls: Record<string, ActionImplementation<any>> = {}

		const rootCallsAs: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}
		const childCallsAs: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}

		for (const key of keys) {
			const name = isHandlerKey(key) ? fromHandlerKey(key) : key
			const explicit = !isHandlerKey(key)
			if (typeof name === "symbol") continue

			// skip fields on the child object that aren't functions,
			// but don't perform this check for implicit calls, since
			// they won't be defined as a function
			if (explicit && typeof (this as any)[name] !== "function") continue

			// set up direct calls
			if (explicit) {
				// handle explicitly defined call (this.message()) on child
				childCalls[name] = function (...args: any[]) {
					return parent[name].apply(instance, args)
				}
			} else {
				// handle implicitly defined call (this.onMessage()) on root
				rootCalls[name] = function (...args: any[]) {
					return instance.#app?.actions[name].call(this, args)
				}
			}

			// set up .as() calls
			if (explicit) {
				childCallsAs[name] = function (signer: SessionSigner<any>, ...args: any[]) {
					// is signer lost here?
					instance.#contextSigner = signer
					return instance._tx[name].apply(instance, args)
				}
				// manually propagate child calls up to parent
				rootCallsAs[name] = function (signer: SessionSigner<any>, ...args: any[]) {
					// is this handled correctly?
					return instance.#app?.actions[name].call(this, args, { signer })
				}
			} else {
				childCallsAs[name] = function (signer: SessionSigner<any>, ...args: any[]) {
					return instance.#app?.actions[name].call(this, args, { signer })
				}
				rootCallsAs[name] = function (signer: SessionSigner<any>, ...args: any[]) {
					return instance.#app?.actions[name].call(this, args, { signer })
				}
			}
		}

		parent._tx = rootCalls as typeof this._tx
		this._tx = { ...childCalls, ...rootCalls } as typeof this._tx // child shadows root
		Object.assign(parent, rootCalls)
		Object.assign(this, childCalls)

		this.as = (signer: SessionSigner<any>) => {
			return Object.fromEntries(Object.entries(childCallsAs).map(([key, call]) => [key, call.bind(instance, signer)]))
		}

		parent.as = (signer: SessionSigner<any>) => {
			const calls = { ...rootCallsAs } // root shadows child
			return Object.fromEntries(Object.entries(calls).map(([key, call]) => [key, call.bind(instance, signer)]))
		}

		this.#ready = new Promise((resolve, reject) => {
			Canvas.initialize({
				topic: this.topic,
				contract,
			})
				.then((app) => {
					this.#app = app
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
