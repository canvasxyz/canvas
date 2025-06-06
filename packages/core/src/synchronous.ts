import { ModelValueWithIncludes, QueryParams } from "@canvas-js/modeldb"
import { Awaitable } from "@canvas-js/interfaces"

import type { Contract } from "@canvas-js/core/contract"
import { assert } from "@canvas-js/utils"

import type { ActionAPI, ContractAction, ModelSchema, ModelValue } from "./types.js"
import type { Config } from "./Canvas.js"
import { Canvas as Core } from "./Canvas.js"

/**
 * A synchronously loaded proxy for the main Canvas object, that
 * provides deferred calls on `app.actions` and `app.db`.
 * Other calls will fail with an error until the object is initialized.
 *
 * This can be used in SSR applications that require an immediately
 * usable `Canvas` object: `new Canvas({ ... })`
 */
export class Canvas<
	ModelsT extends ModelSchema = any,
	InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
> {
	initPromise: Promise<Core<ModelsT, InstanceT>>
	ready: boolean
	app: Core<ModelsT, InstanceT> | undefined
	actions: any
	db: any

	constructor(config: Config<ModelsT, InstanceT>, { disableSSR }: { disableSSR?: boolean } = {}) {
		this.actions = {} // empty actions stub
		this.db = {}

		if (disableSSR && typeof window === "undefined") {
			this.initPromise = Promise.reject()
			this.ready = false
			return
		}

		// if (typeof config.contract === "string") {
		// 	throw new Error("unsupported")
		// }

		this.initPromise = Core.initialize(config)
		this.ready = false

		this.initPromise.then((app) => {
			this.ready = true
			this.app = app
		})

		const actionsProxy = new Proxy(this, {
			get: (innerTarget, action) => {
				return async (...args: any[]) => {
					await this.initPromise
					assert(this.app, "app failed to initialize")
					assert(typeof action === "string", "action names must be strings")
					const { [action]: actionAPI } = this.app.actions as Record<string, ActionAPI>
					return actionAPI(...args)
				}
			},
		})

		const dbProxy = new Proxy(this, {
			get: (innerTarget, call) => {
				if (call === "subscribe") {
					if (!this.app)
						return async (
							modelName: string,
							queryParams: QueryParams,
							callback: (results: ModelValue[] | ModelValueWithIncludes[]) => Awaitable<void>,
						) => {
							await this.initPromise
							assert(this.app, "app failed to initialize")
							return this.app.db.subscribe.call(this.app.db, modelName, queryParams, callback)
						}
					return this.app.db.subscribe.bind(this.app.db)
				}
				return async (...args: any[]) => {
					await this.initPromise
					assert(this.app, "app failed to initialize")
					assert(typeof call === "string", "db calls must be strings")
					assert(call in this.app.db, `invalid db api ${call}`)
					return (this.app.db as any)[call](...args)
				}
			},
		})

		return new Proxy(this, {
			get: (target, prop) => {
				if (prop === "db") {
					return dbProxy
				} else if (prop === "actions") {
					return actionsProxy
				} else if (prop === "isProxy") {
					return true
				} else if (prop === "initPromise" || prop === "ready") {
					return target[prop]
				} else if (!target.app) {
					throw new Error("@canvas-js/core/sync: only actions and db can be accessed before initialization")
				} else {
					assert(typeof prop === "string")
					return typeof (target.app as any)[prop] === "function"
						? (target.app as any)[prop].bind(target.app)
						: (target.app as any)[prop]
				}
			},
		})
	}
}

declare module "./synchronous.js" {
	interface Canvas<
		ModelsT extends ModelSchema = any,
		InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
	> extends Omit<Core<ModelsT, InstanceT>, "addEventListener" | "removeEventListener" | "dispatchEvent"> {}
}
