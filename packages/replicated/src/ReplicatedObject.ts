import crypto from "crypto"
import { mkdirSync } from "fs"

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

export abstract class ReplicatedObject {
	#app: Canvas | null
	#ready: Promise<ReplicatedObject>;

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

		const contract = { models, actions: {} }
		const actions: Record<string, ActionImplementation<any>> = {}
		const actionCalls: Record<string, ActionImplementation<any>> = {}

		for (const key of actionHandlerKeys) {
			if (typeof key === "symbol") continue
			if (typeof (this as any)[key] !== "function") continue
			const name = key[2].toLowerCase() + key.slice(3)

			// shim object contract -> class contract (receive action, injected into object contract)
			actions[name] = (parentDb, parentArgs, parentContext) => {
				const context = {
					db: { set: parentDb.set, get: parentDb.get },
					...parentContext,
				}
				this[key].apply(context, parentArgs)
			}

			// shim class contract -> object contract (send action call)
			actionCalls[name] = (...args: any[]) => {
				this.#app?.actions[name].call(this, args)
			}
		}

		Object.assign(contract.actions, actions)
		Object.assign(this, actionCalls)

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const instance = this

		this.#ready = new Promise((resolve, reject) => {
			const path = `/tmp/canvas_${crypto.randomBytes(8).toString("hex")}`
			mkdirSync(path)
			Canvas.initialize({
				path,
				topic,
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
