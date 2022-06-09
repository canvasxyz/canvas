/// <reference types="../types/random-access-storage" />
/// <reference types="../types/hyperbee" />
/// <reference types="../types/hypercore" />

import fetch from "node-fetch"
import { Buffer } from "buffer"
import { ethers } from "ethers"

import { QuickJSWASMModule, QuickJSRuntime, QuickJSContext, QuickJSHandle, isFail } from "quickjs-emscripten"
import type { RandomAccessStorage } from "random-access-storage"
import HyperBee from "hyperbee"
import hypercore, { Feed } from "hypercore"

import * as t from "io-ts"

import {
	Model,
	ModelValue,
	Action,
	ActionArgument,
	ActionResult,
	ActionPayload,
	Session,
	SessionPayload,
	verifyActionSignature,
	verifySessionSignature,
} from "@canvas-js/interfaces"

import { modelType, actionType, actionArgumentType, sessionType } from "./codecs.js"
import { EventEmitter, CustomEvent } from "./events.js"
import { assert, getColumnType, validateType } from "./utils.js"

interface CoreEvents {
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

export abstract class Core extends EventEmitter<CoreEvents> {
	public abstract setModel(name: string, params: Record<string, ModelValue>): void
	public abstract getRoute(
		route: string,
		params?: Record<string, ModelValue>
	): Record<string, ModelValue>[] | Promise<Record<string, ModelValue>[]>

	public readonly spec: string
	public readonly multihash: string
	public readonly models: Record<string, Model> = {}
	public readonly routes: Record<string, string> = {}
	public readonly routeParameters: Record<string, string[]> = {}
	public readonly actionParameters: Record<string, string[]> = {}

	public feed: Feed
	public hyperbee: HyperBee

	private readonly runtime: QuickJSRuntime
	private readonly vm: QuickJSContext
	private readonly actionFunctions: Record<string, QuickJSHandle> = {}

	// This is a *mutable* slot for the payload of the "currently executing action".
	// It starts as null, gets set at the beginning of apply, and gets re-set to null
	// by the end of apply. This is a little hacky but it makes stuff way simpler.
	private currentActionPayload: ActionPayload | null = null

	constructor(config: {
		multihash: string
		spec: string
		storage: (file: string) => RandomAccessStorage
		quickJS: QuickJSWASMModule
	}) {
		super()

		this.multihash = config.multihash
		this.spec = config.spec

		this.runtime = config.quickJS.newRuntime()

		this.runtime.setMemoryLimit(1024 * 640) // 640kb memory limit
		this.runtime.setModuleLoader((moduleName: string) => {
			if (moduleName === this.multihash) {
				return config.spec
			} else {
				throw new Error("module imports are not allowed")
			}
		})

		this.vm = this.runtime.newContext()
		this.initializeGlobalVariables()

		const importResult = this.vm.evalCode(`import * as spec from "${this.multihash}"; Object.assign(globalThis, spec);`)
		if (isFail(importResult)) {
			const message = this.vm.getProp(importResult.error, "message").consume(this.vm.getString)
			importResult.error.dispose()
			throw new Error(`Failed to load spec: ${message}`)
		}

		this.initializeModels()
		this.initializeRoutes()
		this.initializeActions()

		this.feed = hypercore(config.storage, { createIfMissing: true, overwrite: false })
		this.hyperbee = new HyperBee(this.feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })
	}

	private initializeGlobalVariables() {
		// Set up some globals that are useful to have in the spec VM.
		// console.log:
		const logHandle = this.vm.newFunction("log", (...args: any) => {
			const nativeArgs = args.map(this.vm.dump)
			console.log("[canvas-vm]", ...nativeArgs)
		})

		const consoleHandle = this.vm.newObject()
		this.vm.setProp(consoleHandle, "log", logHandle)
		this.vm.setProp(this.vm.global, "console", consoleHandle)
		consoleHandle.dispose()
		logHandle.dispose()

		const fetchHandle = this.vm.newFunction("fetch", (urlHandle: QuickJSHandle) => {
			const url = this.vm.getString(urlHandle)
			const deferred = this.vm.newPromise()
			console.log("[canvas-vm] fetch:", url)

			fetch(url)
				.then((res) => res.text())
				.then((data) => {
					console.log(`[canvas-vm] fetch success: ${url} (${data.length} bytes)`)
					this.vm.newString(data).consume((val) => deferred.resolve(val))
				})
				.catch((err) => {
					console.log("[canvas-vm] fetch error:", err.message)
					deferred.reject(err.message)
				})
			deferred.settled.then(this.vm.runtime.executePendingJobs)
			return deferred.handle
		})

		this.vm.setProp(this.vm.global, "fetch", fetchHandle)
		fetchHandle.dispose()
	}

	private initializeModels() {
		const models = this.vm.getProp(this.vm.global, "models").consume(this.vm.dump)
		assert(t.record(t.string, modelType).is(models), "invalid models export")

		for (const [name, model] of Object.entries(models)) {
			assert(/^[a-zA-Z0-9_]+$/.test(name), "invalid model name")
			this.models[name] = model
		}
	}

	private getModelAPI(from: string, timestamp: number) {
		const modelAPI = this.vm.newObject()
		const models = this.vm.getProp(this.vm.global, "models").consume(this.vm.dump)
		assert(t.record(t.string, modelType).is(models), "invalid models export")

		for (const [name, model] of Object.entries(models)) {
			const setFunction = this.vm.newFunction("set", (key: QuickJSHandle, value: QuickJSHandle) => {
				try {
					const id = key.consume(this.vm.getString)
					const params = value.consume(this.vm.dump)

					assert(typeof params === "object", "object parameters expected: this.db.table.set(id, { field })")
					assert(model.from === undefined, "this.db.table.set(id, { field }) attempted to overwrite from field")
					assert(model.timestamp === undefined, "this.db.table.set(id, { field }) attempted to overwrite timestamp")
					for (const [field, type] of Object.entries(model)) {
						validateType(type, params[field])
					}

					this.setModel(name, { ...params, id, from, timestamp })
					console.log(`saved to model ${name}: ${id}`)
				} catch (err) {
					console.log(`error saving to model ${name}: ${err instanceof Error ? err.message : err}`)
				}
			})

			const thisAPI = this.vm.newObject()
			this.vm.setProp(thisAPI, "set", setFunction)
			this.vm.setProp(modelAPI, name, thisAPI)
		}
		return modelAPI
	}

	private initializeRoutes() {
		const routes = this.vm.getProp(this.vm.global, "routes").consume(this.vm.dump)
		assert(t.record(t.string, t.string).is(routes), "invalid routes export")
		const routePattern = /^(\/:?[a-zA-Z0-9_]+)+$/
		const routeParamPattern = /:([a-zA-Z0-9_]+)/g
		for (const [route, query] of Object.entries(routes)) {
			assert(routePattern.test(route), "invalid route")
			this.routes[route] = query
			const params: string[] = []
			for (const [_, param] of route.matchAll(routeParamPattern)) {
				params.push(param)
			}
			this.routeParameters[route] = params
		}
	}

	private initializeActions() {
		const actions = this.vm.getProp(this.vm.global, "actions")
		const globalObject = this.vm.getProp(this.vm.global, "Object")
		const globalObjectKeys = this.vm.getProp(globalObject, "keys")
		const actionNames = this.vm
			.unwrapResult(this.vm.callFunction(globalObjectKeys, globalObject, actions))
			.consume(this.vm.dump)

		assert(t.array(t.string).is(actionNames), "invalid actions export")
		const globalFunction = this.vm.getProp(this.vm.global, "Function")
		const globalFunctionPrototype = this.vm.getProp(globalFunction, "__proto__")
		const globalFunctionPrototypeToString = this.vm.getProp(globalFunctionPrototype, "toString")
		for (const name of actionNames) {
			assert(/^[a-zA-Z0-9_]+$/.test(name), "invalid action name")
			const action = this.vm.getProp(actions, name)
			const serializedActionHandler = this.vm
				.unwrapResult(this.vm.callFunction(globalFunctionPrototypeToString, action))
				.consume(this.vm.dump)

			this.actionFunctions[name] = action
			this.actionParameters[name] = Core.parseFunctionParameters(serializedActionHandler)
		}
	}

	private static parseFunctionParameters(source: string) {
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

	public async close() {
		this.vm.dispose()

		await new Promise<void>((resolve, reject) => {
			this.feed.close((err) => {
				if (err === null) {
					resolve()
				} else {
					reject(err)
				}
			})
		})
	}

	/**
	 * Executes an action.
	 */
	public async apply(action: Action, options: { replaying?: boolean } = {}): Promise<ActionResult> {
		/**
		 * Get the current time.
		 *
		 * We should eventually use a more reliable source than the system clock, to avoid
		 * synchronization issues between different clients who hold the same public key.
		 */
		const currentTime = Date.now().valueOf()
		const boundsCheckLowerLimit = new Date("2020").valueOf()
		const boundsCheckUpperLimit = new Date("2070").valueOf()

		/**
		 * Verify the action matches the payload.
		 *
		 * Provide informative errors by checking each field individually (this should be turned off in production).
		 */
		if (action.signature === undefined) console.log("missing action.signature")
		if (action.payload.from === undefined) console.log("missing action.payload.from")
		if (action.payload.spec === undefined) console.log("missing action.payload.spec")
		if (action.payload.timestamp === undefined) console.log("missing action.payload.timestamp")
		if (action.payload.call === undefined) console.log("missing action.payload.call")
		if (action.payload.args === undefined) console.log("missing action.payload.args")
		if (!Array.isArray(action.payload.args)) console.log("action.payload.args should be an array")
		if (action.payload.args.some((a: ActionArgument) => !actionArgumentType.is(a))) {
			console.log("action.payload.args should only include primitive types")
		}

		assert(actionType.is(action), "invalid action")

		/**
		 * Verify the action signature
		 *
		 * If the action is signed by a session key, then:
		 *  - `action.from` === `payload.from` === `session.from` is the key used to generate the session
		 *  - `action.session` === `session.session_public_key` is the key used to sign the payload
		 *
		 * We get the session out of hyperbee, validate it's not malformed, not expired, and matches the action.
		 */
		if (action.session !== null) {
			const record = await this.hyperbee.get(Core.getSessionKey(action.session))
			assert(record !== null, "action signed by invalid session")
			assert(typeof record.value === "string", "got invalid session from HyperBee")

			const session = JSON.parse(record.value)
			assert(sessionType.is(session), "got invalid session from HyperBee")

			// We don't guard against session timestamps in the future because the server clock might be out of sync.
			// But actions and sessions should have been signed on the same client, so we enforce ordering there.
			// assert(session.payload.timestamp < currentTime, "session timestamp too far in the future")

			if (!options.replaying) {
				assert(session.payload.timestamp + session.payload.session_duration > currentTime, "session expired")
				assert(session.payload.timestamp <= action.payload.timestamp, "session timestamp must precede action timestamp")
			}

			assert(
				action.payload.from === session.payload.from,
				"invalid signature (action.payload.from and session.payload.from do not match)"
			)

			const verifiedAddress = verifyActionSignature(action)
			assert(
				verifiedAddress.toLowerCase() === action.session.toLowerCase(),
				"invalid signature (recovered address does not match)"
			)
			assert(
				verifiedAddress.toLowerCase() === session.payload.session_public_key.toLowerCase(),
				"invalid signature (action, session do not match)"
			)
		} else {
			const verifiedAddress = verifyActionSignature(action)
			assert(verifiedAddress === action.payload.from.toLowerCase(), "action signed by wrong address")
		}

		// We don't guard against action timestamps in the future because the server clock might be out of sync.
		// assert(payload.timestamp < currentTime, "action timestamp too far in the future")

		assert(action.payload.timestamp > boundsCheckLowerLimit, "action timestamp too far in the past")
		assert(action.payload.timestamp < boundsCheckUpperLimit, "action timestamp too far in the future")

		assert(action.payload.spec === this.multihash, "action signed for wrong spec")
		assert(action.payload.call !== "", "missing action function")
		assert(action.payload.call in this.actionFunctions, "invalid action function")

		this.currentActionPayload = action.payload

		assert(action.signature.startsWith("0x"))
		const hash = ethers.utils.sha256(action.signature)

		const context = this.vm.newObject()
		const hashString = this.vm.newString(hash)
		const fromString = this.vm.newString(action.payload.from)
		const timestampNumber = this.vm.newNumber(action.payload.timestamp)

		this.vm.setProp(this.vm.global, "from", fromString)
		this.vm.setProp(this.vm.global, "timestamp", timestampNumber)

		this.vm.setProp(context, "db", this.getModelAPI(action.payload.from, action.payload.timestamp))
		this.vm.setProp(context, "from", fromString)
		this.vm.setProp(context, "timestamp", timestampNumber)
		this.vm.setProp(context, "hash", hashString)
		const args = action.payload.args.map((arg) => this.parseActionArgument(arg))
		const handler = this.actionFunctions[action.payload.call]

		// resolve any promise returned by async action handlers
		const result = this.vm.unwrapResult(this.vm.callFunction(handler, context, ...args))
		const promise = result.consume((result) => this.vm.resolvePromise(result))
		this.vm.runtime.executePendingJobs()
		const asyncResult = await promise

		if (isFail(asyncResult)) {
			const error = asyncResult.error.consume(this.vm.dump)
			const message = JSON.stringify(error, null, "  ")
			throw new Error(`action application failed: ${message}`)
		}

		asyncResult.value.dispose()
		hashString.dispose()
		fromString.dispose()
		timestampNumber.dispose()
		this.currentActionPayload = null

		// if everything succeeds
		if (!options.replaying) {
			await this.hyperbee.put(Core.getActionKey(action.signature), JSON.stringify(action))
		}

		this.dispatchEvent(new CustomEvent("action", { detail: action.payload }))
		return { hash }
	}

	private parseActionArgument(arg: ActionArgument): QuickJSHandle {
		if (arg === null) {
			return this.vm.null
		} else if (arg === true) {
			return this.vm.true
		} else if (arg === false) {
			return this.vm.false
		} else if (typeof arg === "number") {
			return this.vm.newNumber(arg)
		} else if (typeof arg === "string") {
			return this.vm.newString(arg)
		} else {
			throw new Error("invalid action argument")
		}
	}

	/**
	 * Create a new session.
	 */
	public async session(session: Session) {
		assert(sessionType.is(session), "invalid session")
		assert(session.payload.spec === this.multihash, "session signed for wrong spec")

		const verifiedAddress = verifySessionSignature(session)
		assert(verifiedAddress === session.payload.from.toLowerCase(), "session signed by wrong address")

		const key = Core.getSessionKey(session.payload.session_public_key)
		await this.hyperbee.put(key, JSON.stringify(session))
		this.dispatchEvent(new CustomEvent("session", { detail: session.payload }))
	}

	/**
	 * Replays the action log to reconstruct views.
	 */
	public async replay() {
		for await (const { type, key, value } of this.hyperbee.createHistoryStream()) {
			if (type === "put") {
				if (typeof key !== "string" || typeof value !== "string") {
					throw new Error("Invalid entry in hyperbee history stream")
				}

				if (key.startsWith(Core.actionKeyPrefix)) {
					const action = JSON.parse(value)
					assert(actionType.is(action), "Invalid action value in hyperbee history stream")
					await this.apply(action, { replaying: true })
				}
			}
		}
	}

	private static getActionKey(signature: string): string {
		assert(signature.startsWith("0x"))
		const bytes = Buffer.from(signature.slice(2), "hex")
		return Core.actionKeyPrefix + ethers.utils.sha256(bytes)
	}

	private static getSessionKey(sessionPublicKey: string): string {
		assert(sessionPublicKey.startsWith("0x"))
		return Core.sessionKeyPrefix + sessionPublicKey.slice(2)
	}

	private static readonly sessionKeyPrefix = "s:"
	private static readonly actionKeyPrefix = "a:"

	public async *getSessionStream(options: { limit?: number } = {}): AsyncIterable<[string, Action]> {
		for await (const [key, value] of this.createPrefixStream(Core.sessionKeyPrefix, options)) {
			yield [key.replace(/^s:/, "0x"), JSON.parse(value)]
		}
	}

	public async *getActionStream(options: { limit?: number } = {}): AsyncIterable<[string, Action]> {
		for await (const [key, value] of this.createPrefixStream(Core.actionKeyPrefix, options)) {
			yield [key.replace(/^a:/, "0x"), JSON.parse(value)]
		}
	}

	private async *createPrefixStream(prefix: string, options: { limit?: number }): AsyncIterable<[string, string]> {
		const limit = options.limit === undefined || options.limit === -1 ? Infinity : options.limit
		if (limit === 0) {
			return
		}

		const deletedKeys = new Set<string>()

		let n = 0
		for await (const entry of this.hyperbee.createHistoryStream<string, string>({ reverse: true })) {
			if (entry.key.startsWith(prefix)) {
				if (entry.type === "del") {
					deletedKeys.add(entry.key)
				} else if (entry.type === "put") {
					if (deletedKeys.has(entry.key)) {
						continue
					} else {
						yield [entry.key, entry.value]
						n++
						if (n >= limit) {
							return
						}
					}
				}
			}
		}
	}

	static getDatabaseSchema(models: Record<string, Model>): string {
		const tables: string[] = []
		for (const [name, model] of Object.entries(models)) {
			const columns = ["id TEXT PRIMARY KEY NOT NULL", "timestamp INTEGER NOT NULL"]
			for (const field of Object.keys(model)) {
				assert(field !== "id" && field !== "timestamp", "fields can't be named 'id' or 'timestamp'")
				columns.push(`${field} ${getColumnType(model[field])}`)
			}

			tables.push(`CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")});`)
		}
		return tables.join("\n")
	}
}
