import { ActionImplementation, Canvas, Model, CanvasConfig } from "@canvas-js/core"
import { ModelsInit } from "@canvas-js/modeldb"

type ReplicatedChild = typeof Replicated.constructor & {
	db?: ModelsInit
	topic?: string
}

type ReplicatedConfig = {
	topic?: string
}

export class Replicated {
	#app: Canvas | null
	#ready: Promise<Replicated>
	#instance: Replicated

	constructor(config: ReplicatedConfig = {}) {
		this.#app = null
		this.#instance = this

		const topic = config.topic ?? (this.constructor as ReplicatedChild).topic
		const models = (this.constructor as ReplicatedChild).db ?? {}

		const keys = Reflect.ownKeys(Object.getPrototypeOf(this)).filter((key) => key !== 'constructor')
		const actionHandlerKeys = keys.filter((key) => typeof key === "string" && key.match(/^on[A-Z].*/))
		const actions: Record<string, ActionImplementation<any>> = {}
		for (const key of actionHandlerKeys) {
			if (typeof key === "symbol") continue
			if (typeof (this as any)[key] !== "function") continue // TODO: proxy typings for Replicated class
			const name = key[2].toLowerCase() + key.slice(3)
			actions[name] = (...args: any[]) => (this as any)[key].call(...args) as ActionImplementation<any>
		}

		this.#ready = new Promise((resolve, reject) => {
			Canvas.initialize({
				topic,
				contract: {
					models,
					actions,
				}
			}).then((app) => {
				this.#app = app
				resolve(this.#instance)
			}).catch((err) => {
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
}
