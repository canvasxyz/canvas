import type { ModelSchema } from "@canvas-js/core"
import { assert } from "@canvas-js/utils"

import type { Actions } from "./types.js"
import type { Config } from "./Canvas.js"
import { Canvas } from "./Canvas.js"

/**
 * A synchronously loaded proxy for the main Canvas object, that
 * defers calls on `app.actions` and `app.db`.
 *
 * This can be used in SSR applications, in the Vercel Edge runtime,
 * and other places that require an immediately usable `Canvas` object
 * by calling `const app = CanvasLoadable({ ... })`.
 */
export class CanvasLoadable<M extends ModelSchema = any, A extends Actions<M> = Actions<M>> {
	initPromise: Promise<Canvas<M, Actions<M>>>
	ready: boolean
	app: Canvas<M, Actions<M>> | undefined
	actions: {}

	constructor(config: Config<M>, { disableSSR }: { disableSSR?: boolean } = {}) {
		this.actions = {} // stub actions for ssr

		if (disableSSR && typeof window === "undefined") {
			this.initPromise = Promise.reject()
			this.ready = false
			return
		}

		if (typeof config.contract === "string") {
			throw new Error("unsupported")
		}

		this.initPromise = Canvas.initialize(config)
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
					return this.app.actions[action](...args)
				}
			},
		})

		const dbProxy = new Proxy(this, {
			get: (innerTarget, call) => {
				if (call === "subscribe") {
					if (!this.app)
						return async (...args) => {
							await this.initPromise
							assert(this.app, "app failed to initialize")
							return this.app.db.subscribe.call(this.app.db, ...args)
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
					throw new Error("CanvasLoadable: only actions and db can be accessed before initialization")
				} else {
					assert(typeof prop === "string")
					return (target.app as any)[prop]
				}
			},
		})
	}
}
