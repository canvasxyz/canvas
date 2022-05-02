import { Buffer } from "buffer"
import { ethers } from "ethers"

import { QuickJSWASMModule, QuickJSRuntime, QuickJSContext, QuickJSHandle, isFail } from "quickjs-emscripten"
import type { RandomAccessStorage } from "random-access-storage"
import HyperBee from "hyperbee"
import hypercore, { Feed } from "hypercore"

import * as t from "io-ts"

import { assert } from "./utils.js"

import {
	Action,
	actionType,
	actionPayloadType,
	sessionPayloadType,
	ActionPayload,
	ActionArgument,
	ActionResult,
} from "./actions.js"
import { getColumnType, Model, modelType, ModelValue, validateType } from "./models.js"
import { string } from "fp-ts"

export abstract class Core {
	public abstract setModel(name: string, params: Record<string, ModelValue>): void
	public abstract getRoute(
		route: string,
		params?: Record<string, ModelValue>
	): Record<string, ModelValue>[] | Promise<Record<string, ModelValue>[]>

	public readonly multihash: string
	public readonly models: Record<string, Model> = {}
	public readonly routes: Record<string, string> = {}
	public readonly routeParameters: Record<string, string[]> = {}
	public readonly actionParameters: Record<string, string[]> = {}

	public feed: Feed
	public hyperbee: HyperBee

	private readonly runtime: QuickJSRuntime
	private readonly vm: QuickJSContext
	private readonly modelAPI: QuickJSHandle
	private readonly actionFunctions: Record<string, QuickJSHandle> = {}

	// This is a *mutable* slot for the payload of the "currently executing action".
	// It starts as null, gets set at the beginning of apply, and gets re-set to null
	// by the end of apply. This is a little hacky but it makes stuff way simpler.
	private currentPayload: ActionPayload | null = null

	constructor(config: {
		multihash: string
		spec: string
		storage: (file: string) => RandomAccessStorage
		quickJS: QuickJSWASMModule
	}) {
		this.multihash = config.multihash

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
		this.modelAPI = this.vm.newObject()
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
	}

	private initializeModels() {
		const models = this.vm.getProp(this.vm.global, "models").consume(this.vm.dump)
		assert(t.record(t.string, modelType).is(models), "invalid models export")

		for (const [name, model] of Object.entries(models)) {
			assert(/^[a-zA-Z0-9_]+$/.test(name), "invalid model name")
			this.models[name] = model

			const setFunction = this.vm.newFunction("set", (key: QuickJSHandle, value: QuickJSHandle) => {
				assert(this.currentPayload !== null, "internal error: missing currentPayload")
				const id = key.consume(this.vm.getString)
				const params = value.consume(this.vm.dump)
				assert(typeof params === "object", "object parameters expected: this.db.table.set(id, { field })")
				for (const [field, type] of Object.entries(model)) {
					validateType(type, params[field])
				}

				const { from, timestamp } = this.currentPayload
				this.setModel(name, { ...params, id, from, timestamp })
			})

			const modelAPI = this.vm.newObject()
			this.vm.setProp(modelAPI, "set", setFunction)
			this.vm.setProp(this.modelAPI, name, modelAPI)
		}
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
		this.modelAPI.dispose()
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

	public async apply(action: Action): Promise<ActionResult> {
		// Typechecks with warnings for usability
		if (action.from === undefined) console.log("missing action.from")
		if (action.signature === undefined) console.log("missing action.signature")
		if (action.payload === undefined) console.log("missing action.payload")
		assert(actionType.is(action), "invalid action")

		// Verify the action matches the payload
		const payload = JSON.parse(action.payload)
		if (payload.from === undefined) console.log("missing payload.from")
		if (payload.spec === undefined) console.log("missing payload.spec")
		if (payload.timestamp === undefined) console.log("missing payload.timestamp")
		if (payload.call === undefined) console.log("missing payload.call")
		if (payload.args === undefined) console.log("missing payload.args")
		if (!Array.isArray(payload.args)) console.log("payload.args should be an array")
		if (payload.args.some((a: ActionArgument) => Array.isArray(a) || typeof a === "object")) {
			console.log("payload.args should only include primitive types")
		}
		assert(actionPayloadType.is(payload), "invalid message payload")

		/**
		 * Get the current time.
		 * We should check against use a more reliable source than the system clock.
		 */
		const currentTime = +new Date() / 1000
		const boundsCheckLowerLimit = +new Date("2020") / 1000
		const boundsCheckUpperLimit = +new Date("2070") / 1000

		/**
		 * Verify the action signature.
		 *
		 * If the action is signed by a session key, then:
		 *  - `action.from` === `payload.from` === `session.from` is the key used to generate the session
		 *  - `action.session` === `session.session_public_key` is the key used to sign the payload
		 */
		if (action.session !== null) {
			// get the session out of hyperbee
			const record = await this.hyperbee.get(Core.getSessionKey(action.session))
			assert(record !== null, "action signed by invalid session")
			assert(typeof record.value === "string", "got invalid session from HyperBee")

			// validate the session
			const session = JSON.parse(record.value)
			assert(actionType.is(session), "got invalid session from HyperBee")
			const sessionPayload = JSON.parse(session.payload)
			assert(sessionPayloadType.is(sessionPayload), "got invalid session from HyperBee")

			// validate the session has not expired, and that the session timestamp is reasonable
			assert(sessionPayload.timestamp + sessionPayload.session_duration > currentTime, "session expired")
			assert(sessionPayload.timestamp <= payload.timestamp, "session timestamp must precede action timestamp")
			// We don't guard against session timestamps in the future because the server clock might be out of sync.
			// assert(sessionPayload.timestamp < currentTime, "session timestamp too far in the future")

			// validate the session signature on the action we're processing
			assert(action.from === payload.from, "invalid signature (action.from and payload.from do not match)")
			assert(payload.from === session.from, "invalid signature (session.from and payload.from do not match)")

			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(
				verifiedAddress === action.session,
				"invalid signature, or wrong data signed (recovered address does not match)"
			)
			assert(
				action.session === sessionPayload.session_public_key,
				"invalid signature (action.session and session_public_key do not match)"
			)
		} else {
			assert(action.from === payload.from, "action signed by wrong address")
			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(action.from === verifiedAddress, "action signed by wrong address")
		}

		assert(payload.timestamp > boundsCheckLowerLimit, "action timestamp too far in the past")
		assert(payload.timestamp < boundsCheckUpperLimit, "action timestamp too far in the future")
		// We don't guard against session timestamps in the future because the server clock might be out of sync.
		// assert(payload.timestamp < currentTime, "action timestamp too far in the future")

		assert(payload.spec === this.multihash, "action signed for wrong spec")
		assert(payload.call !== "", "missing action function")
		assert(payload.call in this.actionFunctions, "invalid action function")

		this.currentPayload = payload
		const hash = ethers.utils.sha256(Buffer.from(JSON.stringify(payload)))

		const context = this.vm.newObject()
		const hashString = this.vm.newString(hash)
		const fromString = this.vm.newString(payload.from)
		const timestampNumber = this.vm.newNumber(payload.timestamp)
		this.vm.setProp(context, "db", this.modelAPI)
		this.vm.setProp(context, "from", fromString)
		this.vm.setProp(context, "timestamp", timestampNumber)
		this.vm.setProp(context, "hash", hashString)
		const args = payload.args.map((arg) => this.parseActionArgument(arg))
		this.vm.unwrapResult(this.vm.callFunction(this.actionFunctions[payload.call], context, ...args))
		fromString.dispose()
		timestampNumber.dispose()
		this.currentPayload = null

		// if everything succeeds
		this.hyperbee.put(Core.getActionKey(action.signature), JSON.stringify(action))

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
	public async session(session: Action) {
		assert(actionType.is(session), "invalid session")
		const payload = JSON.parse(session.payload)
		assert(sessionPayloadType.is(payload), "invalid session payload")
		assert(payload.from === session.from, "session signed by wrong address")
		assert(payload.spec === this.multihash, "session signed for wrong spec")

		const verifiedAddress = ethers.utils.verifyMessage(session.payload, session.signature)
		assert(session.from === verifiedAddress, "session signed by wrong address")

		const key = Core.getSessionKey(payload.session_public_key)
		await this.hyperbee.put(key, JSON.stringify(session))
	}

	private static getActionKey(signature: string): string {
		assert(signature.startsWith("0x"))
		const bytes = Buffer.from(signature.slice(2), "hex")
		const hash = ethers.utils.sha256(bytes)
		return `a:${hash}`
	}

	private static getSessionKey(session_public_key: string): string {
		assert(session_public_key.startsWith("0x"))
		return `s:${session_public_key.slice(2)}`
	}

	private static sessionKeyPrefix = "s:"
	private static actionKeyPrefix = "a:"

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
