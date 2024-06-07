import { ActionImplementation, Canvas, Model, CanvasConfig, ActionImplementationFunction } from "@canvas-js/core"
import { ModelsInit } from "@canvas-js/modeldb"
import { Awaitable } from "@canvas-js/interfaces"

type ReplicatedInstance = typeof ReplicatedObject.constructor & {
	db?: ModelsInit
	topic?: string
}

export class ReplicatedConfig {
	topic?: string
}

export abstract class ReplicatedObject<T extends object> {
	#app: Canvas | null
	#ready: Promise<ReplicatedObject<T>>;

	// When index signatures are more flexible, we can derive
	// the full set of action calls from T. But right now,
	// object class members have an `any` type, and only action
	// handlers have specific typings.
	[action: string]: any
	[handler: `on${string}`]: (...args: any[]) => void

	constructor(config: ReplicatedConfig = {}) {
		this.#app = null

		// set up topic, models, and actions
		const topic = config.topic ?? (this.constructor as ReplicatedInstance).topic
		const models = (this.constructor as ReplicatedInstance).db ?? {}

		const keys = Reflect.ownKeys(Object.getPrototypeOf(this)).filter((key) => key !== "constructor")
		const actionHandlerKeys = keys.filter((key) => typeof key === "string" && key.match(/^on[A-Z].*/))
		const actions: Record<string, ActionImplementation<any>> = {}
		const actionCalls: Record<string, ActionImplementation<any>> = {}

		for (const key of actionHandlerKeys) {
			if (typeof key === "symbol") continue
			if (typeof (this as any)[key] !== "function") continue
			const name = key[2].toLowerCase() + key.slice(3)

			// called when actions are received by the object
			actions[name] = (parentDb, parentArgs, parentContext) => {
				const context = {
					db: { set: parentDb.set, get: parentDb.get },
					...parentContext,
				}
				this[key].call(context, parentArgs)
			}

			// called to send actions to the object
			actionCalls[name] = (...args: any[]) => {
				this.#app?.actions[name].call(this, args)
			}
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const instance = this

		Object.assign(this, actionCalls)
		this.#ready = new Promise((resolve, reject) => {
			Canvas.initialize({
				topic,
				contract: {
					models,
					actions,
				},
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

	async getApp() {
		return this.#app
	}
}
