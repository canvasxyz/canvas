import { ModelSchema } from "@canvas-js/modeldb"
import { assert } from "@canvas-js/utils"

import { Canvas, Config } from "./index.js"
import { Contract } from "./types.js"

/**
 * A synchronously loaded proxy for the main Canvas object, that
 * defers calls on `app.actions` and `app.db`.
 *
 * This can be used in SSR applications, in the Vercel Edge runtime,
 * and other places that require an immediately usable `Canvas` object
 * by calling `const app = CanvasLoadable({ ... })`.
 */
export class CanvasLoadable<M extends ModelSchema = any, T extends Contract<M> = Contract<M>> {
	initPromise: Promise<Canvas<M, Contract<M>>>
	ready: boolean
	app: Canvas<M, Contract<M>> | undefined

	constructor(config: Config<M>, { disableSSR }: { disableSSR?: boolean } = {}) {
		if (disableSSR && typeof window === "undefined") {
			this.initPromise = Promise.reject()
			this.ready = false
			return
		}
		this.initPromise = Canvas.initialize(config)
		this.ready = false

		this.initPromise.then((app) => {
			this.ready = true
			this.app = app
		})

		return new Proxy(this, {
			get: (target, prop) => {
				if (prop === "initPromise" || prop === "ready") {
					return target[prop]
				} else if (prop === "actions") {
					return new Proxy(this, {
						get: (innerTarget, action) => {
							return async (...args: any[]) => {
								await target.initPromise
								assert(target.app, "app failed to initialize")
								assert(typeof action === "string", "action names must be strings")
								return target.app.actions[action](...args)
							}
						},
					})
				} else if (prop === "db") {
					return new Proxy(this, {
						get: (innerTarget, call) => {
							return async (...args: any[]) => {
								await target.initPromise
								assert(target.app, "app failed to initialize")
								assert(typeof call === "string", "db calls must be strings")
								assert(call in target.app.db, `invalid db api ${call}`)
								return (target.app.db as any)[call](...args)
							}
						},
					})
				} else if (!target.app) {
					throw new Error("only app.actions and app.db are supported before initialization")
				} else {
					assert(typeof prop === "string")
					return (target.app as any)[prop]
				}
			},
		})
	}
}
