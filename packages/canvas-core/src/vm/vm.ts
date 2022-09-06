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

type Exports = {
	models: Record<string, Model>
	actionParameters: Record<string, string[]>
	database?: "sqlite" | "postgres"
	routes?: Record<string, string>
	routeParameters?: Record<string, string[]>
}

export class VM {
	public static async initialize(
		name: string,
		spec: string,
		quickJS: QuickJSWASMModule,
		options: { verbose?: boolean } = {}
	): Promise<{ vm: VM; exports: Exports }> {
		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(VM.RUNTIME_MEMORY_LIMIT)

		const moduleHandle = await loadModule(context, name, spec)
		const {
			database: databaseHandle,
			models: modelsHandle,
			routes: routesHandle,
			actions: actionsHandle,
			// contracts: contractsHandle,
		} = moduleHandle.consume((handle) => unwrapObject(context, handle))

		assert(modelsHandle !== undefined, "spec is missing `models` export")
		assert(actionsHandle !== undefined, "spec is missing `actions` export")
		assert(context.typeof(modelsHandle) === "object", "`models` export must be an object")
		assert(context.typeof(actionsHandle) === "object", "`actions` export must be an object")
		// assert(
		// 	contractsHandle === undefined || context.typeof(contractsHandle) === "object",
		// 	"`contracts` export must be an object"
		// )

		const models = modelsHandle.consume(context.dump)
		assert(modelsType.is(models), "invalid `models` export")

		// validate models
		const modelNamePattern = /^[a-z_]+$/
		const modelPropertyNamePattern = /^[a-z_]+$/
		for (const [name, model] of Object.entries(models)) {
			assertPattern(name, modelNamePattern, "invalid model name")
			assert(name.startsWith("_") === false, "model names cannot begin with an underscore")
			const { indexes, ...properties } = model
			for (const property of Object.keys(properties)) {
				assertPattern(property, modelPropertyNamePattern, "invalid model property name")
				assert(property.startsWith("_") === false, "model property names cannot begin with an underscore")
				assert(property !== "id", "model properties cannot be named `id`")
				assert(property !== "updated_at", "model properties cannot be named `updated_at`")
			}

			if (indexes !== undefined) {
				for (const indexPropertyName of indexes) {
					assert(
						indexPropertyName in properties || indexPropertyName === "updated_at",
						`model specified an invalid index "${indexPropertyName}". can only index on other model properties, or "updated_at"`
					)
				}
			}
		}

		const actionHandles = actionsHandle.consume((handle) => unwrapObject(context, handle))
		for (const handle of Object.values(actionHandles)) {
			assert(context.typeof(handle) === "function")
		}

		// parse and validate action handlers
		const actionParameters: Record<string, string[]> = {}
		const actionNamePattern = /^[a-zA-Z]+$/
		for (const [name, handle] of Object.entries(actionHandles)) {
			assertPattern(name, actionNamePattern, "invalid action name")
			const source = call(context, "Function.prototype.toString", handle).consume(context.getString)
			actionParameters[name] = parseFunctionParameters(source)
		}

		const exports: Exports = { models, actionParameters }

		if (databaseHandle !== undefined) {
			assert(context.typeof(databaseHandle) === "string", "`database` export must be a string")
			const database = databaseHandle.consume(context.getString)
			assert(database === "sqlite" || database === "postgres", "invalid database name, must be 'sqlite' or 'postgres'")
			exports.database = database
		}

		if (routesHandle !== undefined) {
			const routeNamePattern = /^(\/:?[a-z_]+)+$/
			const routeParameterPattern = /:([a-zA-Z0-9_]+)/g

			assert(context.typeof(routesHandle) === "object", "`routes` export must be an object")
			exports.routes = {}
			exports.routeParameters = {}
			for (const [name, handle] of Object.entries(routesHandle.consume((handle) => unwrapObject(context, handle)))) {
				assert(context.typeof(handle) === "string", "route queries must be strings")
				assertPattern(name, routeNamePattern, "invalid route name")
				exports.routes[name] = handle.consume(context.getString)
				exports.routeParameters[name] = []
				for (const [_, param] of name.matchAll(routeParameterPattern)) {
					exports.routeParameters[name].push(param)
				}
			}
		}

		const vm = new VM(runtime, context, actionHandles, models, options)
		return { vm, exports }
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

const assertPattern = (value: string, pattern: RegExp, message: string) =>
	assert(pattern.test(value), `${message}: ${JSON.stringify(value)} does not match pattern ${pattern.source}`)
