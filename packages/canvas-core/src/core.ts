import { Buffer } from "buffer"
import { ethers } from "ethers"
import chalk from "chalk"

import type { QuickJSWASMModule, QuickJSRuntime, QuickJSContext, QuickJSHandle } from "quickjs-emscripten"
import type { RandomAccessStorage } from "random-access-storage"
import HyperBee from "hyperbee"
import hypercore, { Feed } from "hypercore"
import { Client as HyperspaceClient, Server as HyperspaceServer, CoreStore } from "hyperspace"

import * as t from "io-ts"

import { objectSpecToString } from "./utils.js"

import {
	Action,
	Session,
	sessionType,
	sessionPayloadType,
	actionType,
	actionPayloadType,
	ActionPayload,
	ActionArgument,
} from "./actions.js"

import { getColumnType, Model, modelType, ModelValue, validateType } from "./models.js"

export abstract class Core {
	public abstract setModel(name: string, params: Record<string, ModelValue>): void
	public abstract getRoute(
		route: string,
		params?: Record<string, ModelValue>
	): Record<string, ModelValue>[] | Promise<Record<string, ModelValue>[]>

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

	constructor(
		readonly multihash: string,
		spec: string | object,
		options: {
			storage: (file: string) => RandomAccessStorage
			peers?: string[]
		},
		quickJS: QuickJSWASMModule
	) {
		if (!multihash.match(/^[0-9a-zA-Z]+$/)) {
			throw new Error("multihash must be alphanumeric")
		}

		this.runtime = quickJS.newRuntime()

		this.runtime.setMemoryLimit(1024 * 640) // 640kb memory limit
		this.runtime.setModuleLoader((moduleName: string) => {
			if (moduleName === this.multihash) {
				return typeof spec === "string" ? spec : objectSpecToString(spec)
			} else {
				throw new Error("module imports are not allowed")
			}
		})

		this.vm = this.runtime.newContext()
		this.modelAPI = this.vm.newObject()
		this.initializeGlobalVariables()
		// Import the spec, rehydrating any functions that are being passed as strings.
		this.vm
			.unwrapResult(
				this.vm.evalCode(`import * as spec from "${this.multihash}";
for (const name of Object.keys(spec.actions)) {
  if (typeof spec.actions[name] === 'string') {
    spec.actions[name] = new Function('return ' + spec.actions[name])();
  }
}
Object.assign(globalThis, spec);
`)
			)
			.dispose()

		this.initializeModels()
		this.initializeRoutes()
		this.initializeActions()

		this.feed = hypercore(options.storage, { createIfMissing: true, overwrite: false })
		this.hyperbee = new HyperBee(this.feed, { keyEncoding: "utf-8", valueEncoding: "utf-8" })

		// this.initializePeering(hyperspacePort, options.peers || [])
	}

	// private async initializePeering(hyperspacePort: number, peers: string[]) {
	// 	// Bind logging
	// 	this.hyperspaceServer.on("client-open", () => {
	// 		const numPeers = this.hyperspaceServer.networker.peers.size
	// 		if (numPeers === 0) return // Don't announce the local peer
	// 		console.log(chalk.green("Connected new peer"))
	// 	})
	// 	this.hyperspaceServer.on("client-close", () => {
	// 		console.log(chalk.green("Disconnected peer"))
	// 	})

	// 	await this.hyperbee.ready()

	// 	return Promise.all(
	// 		peers.map(
	// 			(peer: string) =>
	// 				new Promise<void>(async (resolve, reject) => {
	// 					const [remoteHost, remotePort] = peer.split("/")[0].split(":")
	// 					const remoteKey = peer.split("/")[1]
	// 					const remoteClient = new HyperspaceClient({
	// 						host: remoteHost,
	// 						port: remotePort,
	// 					})
	// 					// should we use localClient / this.peerstore?
	// 					const core = remoteClient.corestore().get({ key: remoteKey })
	// 					core.on("ready", () => resolve()).on("error", (err: any) => reject(err))
	// 				})
	// 		)
	// 	).then(() => {
	// 		console.log(chalk.green(`Initialized ${peers.length} upstream peers`))
	// 		console.log(chalk.green(`Open to connections at localhost:${hyperspacePort}/${this.multihash}`))
	// 	})
	// }

	private initializeGlobalVariables() {
		// Set up some globals that are useful to have in the spec VM.
		// console.log:
		const logHandle = this.vm.newFunction("log", (...args: any) => {
			const nativeArgs = args.map(this.vm.dump)
			console.log("[worker]", ...nativeArgs)
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
				assert(typeof params === "object")
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

	public async apply(action: Action): Promise<void> {
		assert(actionType.is(action), "invalid action")
		// Verify the action matches the payload
		const payload = JSON.parse(action.payload)
		assert(actionPayloadType.is(payload), "invalid message payload")

		/**
		 * Verify the action signature.
		 *
		 * If the action is signed by a session key, then:
		 *  - `action.from` and `payload.from` and `session.from` are the key used to generate the session
		 *  - `action.session` and `session.session_public_key` are the key used to sign the payload
		 * It is assumed that any session found in `this.sessions` is valid.
		 */
		if (action.session !== null) {
			// TODO: VERIFY THAT THE SESSION HAS NOT EXPIRED + EXPIRE SESSIONS + VERIFY DURATION <= 24 HOURS
			// const session = this.sessions.find((s) => s.session_public_key === action.session)
			const record = await this.hyperbee.get(Core.getSessionKey(action.session))
			assert(record !== null, "action signed by invalid session")
			assert(typeof record.value === "string", "got invalid session from HyperBee")
			const session = JSON.parse(record.value)
			assert(sessionType.is(session), "got invalid session from HyperBee")
			assert(action.from === payload.from, "action signed by invalid session")
			assert(action.from === session.from, "action signed by invalid session")
			assert(action.session === session.session_public_key, "action signed by invalid session")
			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(action.session === verifiedAddress, "action signed by invalid session")
		} else {
			assert(action.from === payload.from, "action signed by wrong address")
			const verifiedAddress = ethers.utils.verifyMessage(action.payload, action.signature)
			assert(action.from === verifiedAddress, "action signed by wrong address")
		}

		assert(payload.spec === this.multihash, "action signed for wrong spec")
		assert(payload.call !== "", "attempted to call an empty action")
		assert(payload.call in this.actionFunctions, "attempted to call an invalid action")

		this.currentPayload = payload
		const context = this.vm.newObject()
		const fromString = this.vm.newString(payload.from)
		const timestampNumber = this.vm.newNumber(payload.timestamp)
		this.vm.setProp(context, "db", this.modelAPI)
		this.vm.setProp(context, "from", fromString)
		this.vm.setProp(context, "timestamp", timestampNumber)
		const args = payload.args.map((arg) => this.parseActionArgument(arg))
		this.vm.unwrapResult(this.vm.callFunction(this.actionFunctions[payload.call], context, ...args))
		fromString.dispose()
		timestampNumber.dispose()
		this.currentPayload = null

		// if everything succeeds
		this.hyperbee.put(Core.getActionKey(action.signature), JSON.stringify(action))
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
		const payload = JSON.parse(session.payload)
		assert(sessionPayloadType.is(payload), "invalid session payload")
		assert(payload.from === session.from, "session signed by wrong address")
		assert(payload.spec === this.multihash, "session signed for wrong spec")

		const verifiedAddress = ethers.utils.verifyMessage(session.payload, session.signature)
		assert(session.from === verifiedAddress, "session signed by wrong address")

		const key = Core.getSessionKey(session.session_public_key)
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

	public async *getSessionStream(options: { limit?: number } = {}): AsyncIterable<[string, Session]> {
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

export function assert(value: boolean, message?: string): asserts value {
	if (!value) {
		if (message === undefined) {
			throw new Error("assertion failed")
		} else {
			throw new Error(message)
		}
	}
}
