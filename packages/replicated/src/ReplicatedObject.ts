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

	tx: { [K in keyof T]: T[K] }
	as: (signer: SessionSigner<any>) => { [k: string]: Call }

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

		this.#app = null

		// set up topic, models, and actions
		this.topic = this.topic ?? config.topic
		const models = (this.constructor as K).db

		if (this.topic === undefined) throw new ReplicatedObjectError("Must define a topic on class or constructor")
		if (Object.keys(models).length === 0) throw new ReplicatedObjectError("Must define a model")

		const isHandlerKey = (key: string | symbol): key is `on${string}` => {
			return typeof key === "string" && key.match(/^on[A-Z].*/) !== null
		}
		const keys = Reflect.ownKeys(Object.getPrototypeOf(this)).filter((key) => key !== "constructor")
		const actionHandlerKeys: `on${string}`[] = keys.filter(isHandlerKey)

		const contract: { models: any; actions: Record<string, Call> } = { models, actions: {} }
		const calls: Record<string, ActionImplementation<any>> = {}
		const callsAs: Record<string, (signer: SessionSigner<any>, ...args: any[]) => any> = {}

		for (const key of actionHandlerKeys) {
			if (typeof key === "symbol") continue
			if (typeof (this as any)[key] !== "function") continue
			const name = key[2].toLowerCase() + key.slice(3)

			contract.actions[name] = (parentDb, parentArgs, parentContext) => {
				const context = {
					db: { set: parentDb.set, get: parentDb.get },
					...parentContext,
				}
				this[key].apply(context, parentArgs)
			}

			calls[name] = function (...args: any[]) {
				return instance.#app?.actions[name].call(this, args)
			}
			callsAs[name] = function (signer: SessionSigner<any>, ...args: any[]) {
				return instance.#app?.actions[name].call(this, args, { signer })
			}
		}

		this.tx = calls as typeof this.tx // this.tx.action()
		Object.assign(this, calls) // this.action()

		this.as = (signer: SessionSigner<any>) => {
			this.#contextSigner = signer
			return Object.fromEntries(Object.entries(callsAs).map(([key, call]) => [key, call.bind(instance, signer)]))
		}

		this.#ready = new Promise((resolve, reject) => {
			const path = `/tmp/canvas_${this.topic}`
			mkdirSync(path)
			Canvas.initialize({
				path,
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
