import assert from "node:assert"

import { isFail, QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from "quickjs-emscripten"
// import * as t from "io-ts"

// we can eliminate this dependency when Node 18 goes LTS with native fetch
import fetch from "node-fetch"

import { ActionArgument, ActionPayload, Model, ModelValue } from "@canvas-js/interfaces"
import type { Effect } from "../models/index.js"
import { modelsType } from "../codecs.js"
import { ApplicationError } from "../errors.js"
import { mapEntries, signalInvalidType } from "../utils.js"

import { loadModule, wrapObject, unwrapObject, disposeCachedHandles, call, wrapJSON, resolvePromise } from "./utils.js"

export class VM {
	public static async initialize(
		name: string,
		spec: string,
		quickJS: QuickJSWASMModule,
		options: { verbose?: boolean } = {}
	): Promise<{
		vm: VM
		// database: "sqlite" | "postgres"
		// routes: Record<string, string>
		models: Record<string, Model>
		actionParameters: Record<string, string[]>
	}> {
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(VM.RUNTIME_MEMORY_LIMIT)

		const moduleHandle = await loadModule(context, name, spec)
		const {
			// database: databaseHandle,
			models: modelsHandle,
			// routes: routesHandle,
			actions: actionsHandle,
			// contracts: contractsHandle,
			// translators: translatorsHandle,
		} = moduleHandle.consume((handle) => unwrapObject(context, handle))

		// assert(databaseHandle !== undefined, "spec is missing `database` export")
		assert(modelsHandle !== undefined, "spec is missing `models` export")
		// assert(routesHandle !== undefined, "spec is missing `routes` export")
		assert(actionsHandle !== undefined, "spec is missing `actions` export")
		// assert(context.typeof(databaseHandle) === "string", "`database` export must be an object")
		assert(context.typeof(modelsHandle) === "object", "`models` export must be an object")
		// assert(context.typeof(routesHandle) === "object", "`routes` export must be an object")
		assert(context.typeof(actionsHandle) === "object", "`actions` export must be an object")
		// assert(
		// 	contractsHandle === undefined || context.typeof(contractsHandle) === "object",
		// 	"`contracts` export must be an object"
		// )
		// assert(
		// 	translatorsHandle === undefined || context.typeof(translatorsHandle) === "object",
		// 	"`translators` export must be an object"
		// )

		// const database = databaseHandle.consume(context.getString)
		// assert(database === "sqlite" || database === "postgres", "invalid database name, must be 'sqlite' or 'postgres'")

		const models = modelsHandle.consume(context.dump)
		assert(modelsType.is(models), "invalid `models` export")

		// const routes = routesHandle.consume(context.dump)
		// assert(t.record(t.string, t.string).is(routes))

		const actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
		for (const handle of Object.values(actionHandles)) {
			assert(context.typeof(handle) === "function")
		}

		// parse and validate action handlers
		const actionParameters: Record<string, string[]> = {}
		const actionNamePattern = /^[a-zA-Z]+$/
		for (const [name, handle] of Object.entries(actionHandles)) {
			assert(actionNamePattern.test(name), "invalid action name")
			const source = call(context, "Function.prototype.toString", handle).consume(context.getString)
			actionParameters[name] = parseFunctionParameters(source)
		}

		const vm = new VM(runtime, context, actionHandles, models, options)

		return {
			vm,
			// database,
			// routes,
			models,
			actionParameters,
		}
	}

	private static readonly RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb
	private readonly dbHandle: QuickJSHandle
	private effects: Effect[] | null = null

	constructor(
		private readonly runtime: QuickJSRuntime,
		private readonly context: QuickJSContext,
		private readonly actionHandles: Record<string, QuickJSHandle>,
		models: Record<string, Model>,
		options: { verbose?: boolean }
	) {
		this.installGlobals(options)

		this.dbHandle = wrapObject(
			context,
			mapEntries(models, (name, model) =>
				wrapObject(context, {
					set: context.newFunction("set", (idHandle, valuesHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined)
						assert(valuesHandle !== undefined)
						const id = idHandle.consume(context.getString)
						const values = this.unwrapModelValues(model, valuesHandle)
						this.effects.push({ type: "set", model: name, id, values })
					}),
					delete: context.newFunction("delete", (idHandle) => {
						assert(this.effects !== null, "internal error: this.effects is null")
						assert(idHandle !== undefined)
						const id = idHandle.consume(context.getString)
						this.effects.push({ type: "del", model: name, id })
					}),
				})
			)
		)
	}

	public dispose() {
		this.dbHandle.dispose()
		for (const handle of Object.values(this.actionHandles)) {
			handle.dispose()
		}

		disposeCachedHandles(this.context)
		this.context.dispose()
		this.runtime.dispose()
	}

	private installGlobals(options: { verbose?: boolean }) {
		const globals = wrapObject(this.context, {
			// log to console:
			console: wrapObject(this.context, {
				log: this.context.newFunction("log", (...args: any[]) => {
					console.log("[canvas-vm]", ...args.map(this.context.dump))
				}),
			}),

			// fetch:
			fetch: this.context.newFunction("fetch", (urlHandle: QuickJSHandle) => {
				assert(this.context.typeof(urlHandle) === "string", "url must be a string")
				const url = this.context.getString(urlHandle)
				const deferred = this.context.newPromise()
				if (options.verbose) {
					console.log("[canvas-vm] fetch:", url)
				}

				fetch(url)
					.then((res) => res.text())
					.then((data) => {
						if (options.verbose) {
							console.log(`[canvas-vm] fetch OK: ${url} (${data.length} bytes)`)
						}

						this.context.newString(data).consume((val) => deferred.resolve(val))
					})
					.catch((err) => {
						console.error("[canvas-vm] fetch error:", err.message)
						deferred.reject(this.context.newString(err.message))
					})

				deferred.settled.then(this.context.runtime.executePendingJobs)
				return deferred.handle
			}),
		})

		call(this.context, "Object.assign", null, this.context.global, globals).dispose()
		globals.dispose()
	}

	/**
	 * Given a call, get a list of effects to pass to `store.applyEffects`, to be applied to the models.
	 * Used by `.apply()` and when replaying actions.
	 */
	public async execute(hash: string, { call, args, spec, from, timestamp }: ActionPayload): Promise<Effect[]> {
		assert(this.effects === null, "cannot apply more than one action at once")

		const actionHandle = this.actionHandles[call]
		assert(actionHandle !== undefined, "invalid action call")

		const argHandles = args.map(this.wrapActionArgument)

		const thisArg = wrapJSON(this.context, { hash, spec, from, timestamp })
		this.context.setProp(thisArg, "db", this.dbHandle)

		// after setting this.effects here, always make sure to reset it to null before
		// returning or throwing an error - or the core won't be able to process more actions
		this.effects = []
		const promiseResult = this.context.callFunction(actionHandle, thisArg, ...argHandles)

		thisArg.dispose()
		for (const handle of argHandles) {
			handle.dispose()
		}

		if (isFail(promiseResult)) {
			const error = promiseResult.error.consume(this.context.dump)
			this.effects = null
			throw new ApplicationError(error)
		}

		const result = await promiseResult.value.consume((handle) => resolvePromise(this.context, handle))
		if (isFail(result)) {
			const error = result.error.consume(this.context.dump)
			this.effects = null
			throw new ApplicationError(error)
		}

		const returnValue = result.value.consume(this.context.dump)
		if (returnValue === false) {
			this.effects = null
			throw new Error("action rejected: not allowed")
		}

		if (returnValue !== undefined) {
			this.effects = null
			throw new Error("action rejected: unexpected return value")
		}

		const effects = this.effects
		this.effects = null
		return effects
	}

	public wrapActionArgument = (arg: ActionArgument): QuickJSHandle => {
		if (arg === null) {
			return this.context.null
		} else if (typeof arg === "boolean") {
			return arg ? this.context.true : this.context.false
		} else if (typeof arg === "number") {
			return this.context.newNumber(arg)
		} else if (typeof arg === "string") {
			return this.context.newString(arg)
		} else {
			signalInvalidType(arg)
		}
	}

	private unwrapModelValues = (model: Model, valuesHandle: QuickJSHandle): Record<string, ModelValue> => {
		const { indexes, ...properties } = model
		const valueHandles = unwrapObject(this.context, valuesHandle)
		const values: Record<string, ModelValue> = {}

		for (const [property, type] of Object.entries(properties)) {
			assert(property in valueHandles)
			const valueHandle = valueHandles[property]
			if (type === "boolean") {
				values[property] = Boolean(valueHandle.consume(this.context.getNumber))
			} else if (type === "integer") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else if (type === "float") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else if (type === "string") {
				values[property] = valueHandle.consume(this.context.getString)
			} else if (type === "datetime") {
				values[property] = valueHandle.consume(this.context.getNumber)
			} else {
				signalInvalidType(type)
			}
		}

		return values
	}
}

function parseFunctionParameters(source: string): string[] {
	return source
		.replace(/[/][/].*$/gm, "") // strip single-line comments
		.replace(/\s+/g, "") // strip white space
		.replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
		.split("){", 1)[0]
		.replace(/^[^(]*[(]/, "") // extract the parameters
		.replace(/=[^,]+/g, "") // strip any ES6 defaults
		.split(",")
		.filter(Boolean) // split & filter [""]
}
