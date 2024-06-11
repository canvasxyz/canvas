import { mkdirSync } from "fs"

import {
	ActionImplementation,
	ActionContext,
	Canvas,
	ModelAPI,
} from "@canvas-js/core"
import { ModelsInit } from "@canvas-js/modeldb"
import { Awaitable } from "@canvas-js/interfaces"

type Instance = typeof ReplicatedObject.constructor & {
	db?: ModelsInit
	topic?: string
}

type Call = (...args: any[]) => Awaitable<void>

export class ReplicatedObjectError extends Error {}

export class ReplicatedConfig {
	topic?: string
}

export abstract class ReplicatedObject<T extends Record<string, Call> = any> {
	#app: Canvas | null
	#ready: Promise<ReplicatedObject>;

	topic?: string

	[handler: `on${string}`]: (...args: any[]) => void

	send: {
		[K in keyof T]: T[K]
	}

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
		this.#app = null

		// set up topic, models, and actions
		this.topic = this.topic ?? config.topic
		const models = (this.constructor as Instance).db ?? {}

		if (this.topic === undefined) throw new ReplicatedObjectError("Must define a topic on class or constructor")

		const isHandlerKey = (key: string | symbol): key is `on${string}` => {
			return typeof key === "string" && key.match(/^on[A-Z].*/) !== null
		}
		const keys = Reflect.ownKeys(Object.getPrototypeOf(this)).filter((key) => key !== "constructor")
		const actionHandlerKeys: `on${string}`[] = keys.filter(isHandlerKey)

		const contract = { models, actions: {} }
		const actions: Record<string, Call> = {}
		const actionCalls: Record<string, ActionImplementation<any>> = {}

		for (const key of actionHandlerKeys) {
			if (typeof key === "symbol") continue
			if (typeof (this as any)[key] !== "function") continue
			const name = key[2].toLowerCase() + key.slice(3)

			// handlers
			actions[name] = (parentDb, parentArgs, parentContext) => {
				const context = {
					db: { set: parentDb.set, get: parentDb.get },
					...parentContext,
				}
				this[key].apply(context, parentArgs)
			}

			// invokers
			actionCalls[name] = (...args: any[]) => {
				this.#app?.actions[name].call(this, args)
			}
		}

		this.send = actionCalls as typeof this.send // { [K in keyof T]: Call }
		Object.assign(contract.actions, actions)
		Object.assign(this, actionCalls)

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const instance = this

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
