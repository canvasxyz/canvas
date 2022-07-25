/// <reference types="../types/random-access-storage" />
/// <reference types="../types/random-access-file" />
/// <reference types="../types/random-access-memory" />

import path from "node:path"
import assert from "node:assert"

import fetch from "node-fetch"
import { ethers } from "ethers"
import {
	isFail,
	QuickJSContext,
	QuickJSHandle,
	QuickJSRuntime,
	QuickJSWASMModule,
	VmCallResult,
} from "quickjs-emscripten"

import randomAccessFile from "random-access-file"
import randomAccessMemory from "random-access-memory"

import PQueue from "p-queue"
import Hash from "ipfs-only-hash"

import {
	Action,
	ActionResult,
	ActionPayload,
	Session,
	SessionPayload,
	verifyActionSignature,
	verifySessionSignature,
	ModelValue,
	Model,
	ContractMetadata,
	Chain,
} from "@canvas-js/interfaces"

import { Store, Effect } from "./store.js"
import { EventEmitter, CustomEvent } from "./events.js"
import { actionType, sessionType, modelsType, chainType, chainIdType } from "./codecs.js"
import { JSONValue, mapEntries, signalInvalidType, PAGE_SIZE } from "./utils.js"
import { ApplicationError } from "./errors.js"

interface CoreConfig {
	name: string
	directory: string | null
	spec: string
	quickJS: QuickJSWASMModule
	replay?: boolean
	development?: boolean
	rpc: Partial<Record<Chain, Record<string, string>>>
}

interface CoreEvents {
	close: Event
	error: Event
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

type BlockInfo = {
	number: number
	timestamp: number
}

export class Core extends EventEmitter<CoreEvents> {
	private static readonly RUNTIME_MEMORY_LIMIT = 1024 * 640 // 640kb

	public static async initialize({
		name,
		directory,
		spec,
		quickJS,
		replay,
		development,
		rpc,
	}: CoreConfig): Promise<Core> {
		if (!development) {
			const cid = await Hash.of(spec)
			assert(cid === name, "Core.name is not equal to the hash of the provided spec.")
		}

		const runtime = quickJS.newRuntime()
		const context = runtime.newContext()
		runtime.setMemoryLimit(Core.RUNTIME_MEMORY_LIMIT)

		const moduleHandle = await loadModule(context, name, spec)
		const core = new Core(name, directory, !!replay, runtime, context, moduleHandle, rpc || {})

		if (replay) {
			console.log(`[canvas-core] Replaying action log...`)
			let i = 0
			for await (const [hash, action] of core.store.getActionStream(PAGE_SIZE)) {
				assert(actionType.is(action), "Invalid action value in action log")
				const effects = await core.getEffects(hash, action.payload)
				core.store.applyEffects(action.payload, effects)
				i++
			}
			console.log(`[canvas-core] Successfully replayed all ${i} entries from the action log.`)
		}

		console.log("[canvas-core] Initialized core", name)
		return core
	}

	public readonly store: Store
	public readonly models: Record<string, Model>
	public readonly routeParameters: Record<string, string[]>
	public readonly actionParameters: Record<string, string[]>
	public readonly contractParameters: Record<string, { metadata: ContractMetadata; contract: ethers.Contract }>
	public readonly contractRpcProviders: Record<string, ethers.providers.JsonRpcProvider>
	public readonly rpcProviders: Partial<Record<Chain, Record<string, ethers.providers.JsonRpcProvider>>>

	public readonly blockCache: Record<string, Record<string, BlockInfo>>
	public readonly blockCacheRecents: Record<string, string[]>

	private readonly queue: PQueue
	private readonly dbHandle: QuickJSHandle
	private readonly actionHandles: Readonly<Record<string, QuickJSHandle>>

	private effects: Effect[] | null

	private constructor(
		public readonly name: string,
		public readonly directory: string | null,
		public readonly replay: boolean,
		public readonly runtime: QuickJSRuntime,
		public readonly context: QuickJSContext,
		public readonly moduleHandle: QuickJSHandle,
		public readonly rpc: Record<string, Record<string, string>>
	) {
		super()
		this.queue = new PQueue({ concurrency: 1 })
		this.rpc = rpc

		const {
			models: modelsHandle,
			routes: routesHandle,
			actions: actionsHandle,
			contracts: contractsHandle,
		} = moduleHandle.consume(this.unwrapObject)

		assert(modelsHandle !== undefined, "spec is missing `models` export")
		assert(routesHandle !== undefined, "spec is missing `routes` export")
		assert(actionsHandle !== undefined, "spec is missing `actions` export")
		assert(context.typeof(modelsHandle) === "object", "`models` export must be an object")
		assert(context.typeof(routesHandle) === "object", "`routes` export must be an object")
		assert(context.typeof(actionsHandle) === "object", "`actions` export must be an object")
		assert(
			contractsHandle === undefined || context.typeof(contractsHandle) === "object",
			"`contracts` export must be an object"
		)

		// parse and validate models
		const models = modelsHandle.consume(this.unwrapJSON)
		assert(modelsType.is(models), "invalid `models` export")
		this.models = models

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

		// parse and validate routes
		const routeHandles = routesHandle.consume(this.unwrapObject)
		const routes = mapEntries(routeHandles, (route, routeHandle) => {
			return routeHandle.consume(context.getString)
		})

		const routeNamePattern = /^(\/:?[a-z_]+)+$/
		const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
		this.routeParameters = {}
		for (const route of Object.keys(routes)) {
			assertPattern(route, routeNamePattern, "invalid route name")
			this.routeParameters[route] = []
			for (const [_, param] of route.matchAll(routeParameterPattern)) {
				this.routeParameters[route].push(param)
			}
		}

		// parse and validate action handlers
		this.actionParameters = {}
		this.actionHandles = actionsHandle.consume(this.unwrapObject)
		const actionNamePattern = /^[a-zA-Z]+$/
		for (const [name, handle] of Object.entries(this.actionHandles)) {
			assertPattern(name, actionNamePattern, "invalid action name")
			const source = this.call("Function.prototype.toString", handle).consume(this.context.getString)
			this.actionParameters[name] = parseFunctionParameters(source)
		}

		// set up cache and rpc
		this.rpcProviders = {}
		this.blockCache = {}
		this.blockCacheRecents = {}
		for (const [chain, chainRpcs] of Object.entries(this.rpc)) {
			this.rpcProviders[chain as Chain] = {}
			for (const [chainId, rpcUrl] of Object.entries(chainRpcs)) {
				const providers = this.rpcProviders[chain as Chain]
				if (!providers) continue

				// set up each chain's rpc and blockhash cache
				const key = chain + ":" + chainId
				this.blockCache[key] = {}
				this.blockCacheRecents[key] = []

				// TODO: consider using JsonRpcBatchProvider
				providers[chainId] = new ethers.providers.JsonRpcProvider(rpcUrl.toString())
				providers[chainId].getBlockNumber().then(async (currentBlock) => {
					const updateCache = async (blocknum: number) => {
						const block = await providers[chainId].getBlock(blocknum)
						const info = { number: block.number, timestamp: block.timestamp }

						// keep up to 128 past blocks
						const CACHE_SIZE = 128
						this.blockCache[key][block.hash] = info
						this.blockCacheRecents[key].push(block.hash)
						if (this.blockCacheRecents[key].length > CACHE_SIZE) {
							const evicted = this.blockCacheRecents[key].shift()
							if (evicted) delete this.blockCache[key][evicted]
						}
					}
					// warm up cache with recent blocks
					for (let n = currentBlock - 10; n <= currentBlock; n++) {
						await updateCache(n)
					}
					// listen for new blocks
					providers[chainId].on("block", updateCache)
				})
			}
		}

		// parse and validate contracts
		this.contractParameters = {}
		this.contractRpcProviders = {}
		if (contractsHandle !== undefined) {
			const contractHandles = contractsHandle.consume(this.unwrapObject)
			const contracts = mapEntries(contractHandles, (contract, contractHandle) => {
				return contractHandle.consume(this.unwrapObject) // TODO: could be number?
			})

			const contractNamePattern = /^[a-zA-Z]+$/
			for (const name of Object.keys(contracts)) {
				assertPattern(name, contractNamePattern, "invalid contract name")
				const chain = this.context.getString(contracts[name].chain)
				const chainId = this.context.getNumber(contracts[name].chainId)
				const address = this.context.getString(contracts[name].address)
				const abi = this.unwrapArray(contracts[name].abi).map(this.context.getString)

				assert(chainType.is(chain), "invalid chain")
				assert(chainIdType.is(chainId), "invalid chain id")

				if (!this.rpc[chain] || !this.rpc[chain][chainId]) {
					throw new Error(
						`[canvas-core] This spec needs an rpc endpoint for on-chain data (${chain}, chain id ${chainId}). Specify one with e.g. "canvas run --chain-rpc eth 1 https://mainnet.infura.io/v3/[APPID]".`
					)
				}
				const rpcUrl = this.rpc[chain][chainId]

				let provider
				if (!this.contractRpcProviders[rpcUrl]) {
					provider = new ethers.providers.JsonRpcProvider(rpcUrl)
					this.contractRpcProviders[rpcUrl] = provider
				} else {
					provider = this.contractRpcProviders[rpcUrl]
				}

				this.contractParameters[name] = {
					metadata: { chain, chainId, address, abi },
					contract: new ethers.Contract(address, abi, provider),
				}
			}
		}

		this.store = new Store(directory, models, routes, replay)

		this.effects = null
		this.dbHandle = this.wrapObject(
			mapEntries(models, (name, { indexes, ...properties }) => {
				const setFunctionHandle = context.newFunction("set", (idHandle: QuickJSHandle, valuesHandle: QuickJSHandle) => {
					assert(this.effects !== null, "internal error: #effects is null")
					assert(idHandle !== undefined)
					assert(valuesHandle !== undefined)
					assert(context.typeof(idHandle) === "string")

					const id = idHandle.consume(context.getString)

					const valueHandles = this.unwrapObject(valuesHandle)
					const values: Record<string, ModelValue> = {}
					for (const [property, type] of Object.entries(properties)) {
						assert(property in valueHandles)
						const valueHandle = valueHandles[property]
						if (type === "boolean") {
							values[property] = Boolean(valueHandle.consume(context.getNumber))
						} else if (type === "integer") {
							values[property] = valueHandle.consume(context.getNumber)
						} else if (type === "float") {
							values[property] = valueHandle.consume(context.getNumber)
						} else if (type === "string") {
							values[property] = valueHandle.consume(context.getString)
						} else if (type === "datetime") {
							values[property] = valueHandle.consume(context.getNumber)
						} else {
							signalInvalidType(type)
						}
					}

					this.effects.push({ type: "set", model: name, id, values })
				})

				const deleteFunctionHandle = this.context.newFunction("delete", (idHandle: QuickJSHandle) => {
					assert(this.effects !== null, "internal error: #effects is null")
					assert(idHandle !== undefined)
					assert(context.typeof(idHandle) === "string")

					const id = idHandle.consume(context.getString)

					this.effects.push({ type: "del", model: name, id })
				})

				return this.wrapObject({
					set: setFunctionHandle,
					delete: deleteFunctionHandle,
				})
			})
		)

		// initialize global variables
		// console.log:
		const consoleHandle = this.wrapObject({
			log: this.context.newFunction("log", (...args: any[]) => {
				console.log("[canvas-vm]", ...args.map(this.context.dump))
			}),
		})

		// fetch:
		const fetchHandle = this.context.newFunction("fetch", (urlHandle: QuickJSHandle) => {
			assert(this.context.typeof(urlHandle) === "string", "url must be a string")
			const url = this.context.getString(urlHandle)
			const deferred = this.context.newPromise()
			console.log("[canvas-vm] fetch:", url)

			fetch(url)
				.then((res) => res.text())
				.then((data) => {
					console.log(`[canvas-vm] fetch success: ${url} (${data.length} bytes)`)
					this.context.newString(data).consume((val) => deferred.resolve(val))
				})
				.catch((err) => {
					console.log("[canvas-vm] fetch error:", err.message)
					deferred.reject(this.context.newString(err.message))
				})
			deferred.settled.then(this.runtime.executePendingJobs)
			return deferred.handle
		})

		// contract:
		const contractHandle = this.context.newFunction("contract", (nameHandle: QuickJSHandle) => {
			assert(this.context.typeof(nameHandle) === "string", "name must be a string")
			const name = this.context.getString(nameHandle)
			const contract = this.contractParameters[name].contract
			const { address, abi } = this.contractParameters[name].metadata
			const deferred = this.context.newPromise()
			console.log("[canvas-vm] using contract:", name, address)

			// produce an object that supports the contract's function calls
			const wrapper: Record<string, QuickJSHandle> = {}
			for (const key in contract.functions) {
				if (typeof key !== "string") continue
				if (key.indexOf("(") !== -1) continue

				wrapper[key] = this.context.newFunction(key, (...argHandles: any[]) => {
					const args = argHandles.map(this.context.dump)
					console.log("[canvas-vm] read from contract:", name, key, args)
					contract[key]
						.apply(this, args)
						.then((result: any) => {
							deferred.resolve(this.context.newString(result.toString()))
						})
						.catch((err: Error) => {
							console.log("[canvas-vm] eth call error:", err.message)
							deferred.reject(this.context.newString(err.message))
						})
					deferred.settled.then(this.runtime.executePendingJobs)
					return deferred.handle
				})
			}
			return this.wrapObject(wrapper)
		})

		const globals = this.wrapObject({
			fetch: fetchHandle,
			contract: contractHandle,
			console: consoleHandle,
		})

		this.call("Object.assign", null, this.context.global, globals).dispose()
		globals.dispose()
	}

	public async onIdle(): Promise<void> {
		await this.queue.onIdle()
	}

	public async close() {
		console.log("[canvas-core] Closing...")
		await this.queue.onEmpty()

		this.dbHandle.dispose()
		for (const handle of Object.values(this.actionHandles)) {
			handle.dispose()
		}

		for (const [key, handle] of Object.entries(this.globalHandleCache)) {
			handle.dispose()
			delete this.globalHandleCache[key]
		}

		this.context.dispose()
		this.runtime.dispose()

		this.store.close()

		this.dispatchEvent(new Event("close"))
	}

	public getRoute(route: string, params: Record<string, ModelValue> = {}): Record<string, ModelValue>[] {
		return this.store.getRoute(route, params)
	}

	private static boundsCheckLowerLimit = new Date("2020").valueOf()
	private static boundsCheckUpperLimit = new Date("2070").valueOf()

	/**
	 * Executes an action.
	 */
	public apply(action: Action): Promise<ActionResult> {
		return this.queue.add(async () => {
			// check the timestamp bounds
			assert(action.payload.timestamp > Core.boundsCheckLowerLimit, "action timestamp too far in the past")
			assert(action.payload.timestamp < Core.boundsCheckUpperLimit, "action timestamp too far in the future")

			// check the block
			assert(action.payload.block, "action signed with invalid block")
			const { chain, chainId, blocknum, blockhash, timestamp } = action.payload.block
			const rpcProviders = this.rpcProviders[chain]

			// TODO: declare the chains and chainIds that each spec will require upfront
			assert(rpcProviders !== undefined, `action signed with unsupported chain: ${chain}`)
			assert(rpcProviders[chainId] !== undefined, `action signed with unsupported chainId: ${chainId}`)

			let block
			if (this.blockCache[chain + ":" + chainId]) {
				block = this.blockCache[chain + ":" + chainId][blockhash]
			} else {
				try {
					console.log(`fetching block ${action.payload.block.blockhash} for ${chain}:${chainId}`)
					block = await rpcProviders[chainId].getBlock(action.payload.block.blockhash)
				} catch (err) {
					// TODO: catch rpc errors and identify those separately vs invalid blockhash errors
					throw new Error("action signed with invalid block hash")
				}
			}

			assert(block, "could not find a valid block:" + JSON.stringify(action.payload.block))
			assert(block?.timestamp === timestamp, "action signed with invalid timestamp")
			assert(block?.number === blocknum, "action signed with invalid block number")

			// Verify the signature
			if (action.session !== null) {
				const sessionKey = Core.getSessionKey(action.session)
				const session = await this.store.getSession(sessionKey)

				assert(session !== null, "session not found")
				assert(
					session.payload.timestamp + session.payload.session_duration > action.payload.timestamp,
					"session expired"
				)
				assert(session.payload.timestamp <= action.payload.timestamp, "session timestamp must precede action timestamp")

				assert(
					action.payload.from === session.payload.from,
					"invalid session key (action.payload.from and session.payload.from do not match)"
				)

				const verifiedAddress = verifyActionSignature(action)
				assert(
					verifiedAddress.toLowerCase() === action.session.toLowerCase(),
					"invalid action signature (recovered address does not match)"
				)
				assert(
					verifiedAddress.toLowerCase() === session.payload.session_public_key.toLowerCase(),
					"invalid action signature (action, session do not match)"
				)
			} else {
				const verifiedAddress = verifyActionSignature(action)
				assert(verifiedAddress.toLowerCase() === action.payload.from.toLowerCase(), "action signed by wrong address")
			}

			const hash = ethers.utils.sha256(action.signature)
			const actionKey = Core.getActionKey(hash)
			const existingRecord = await this.store.getAction(actionKey)
			if (existingRecord === null) {
				await this.store.insertAction(actionKey, action)

				const effects = await this.getEffects(hash, action.payload)
				this.store.applyEffects(action.payload, effects)

				this.dispatchEvent(new CustomEvent("action", { detail: action.payload }))
			}

			return { hash }
		})
	}

	private async getEffects(hash: string, { call, args, spec, from, timestamp }: ActionPayload): Promise<Effect[]> {
		assert(this.effects === null, "cannot apply more than one action at once")

		const actionHandle = this.actionHandles[call]
		assert(actionHandle !== undefined, "invalid action call")

		const argHandles = args.map(this.wrapJSON)

		// we can't use wrapObject here because wrapObject disposes of its children!
		const thisArg = this.wrapJSON({ hash, spec, from, timestamp })
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

		const result = await promiseResult.value.consume((promiseHandle) => resolvePromise(this.context, promiseHandle))
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

	/**
	 * Create a new session.
	 */
	public session(session: Session): Promise<void> {
		return this.queue.add(async () => {
			assert(sessionType.is(session), "invalid session")
			assert(session.payload.spec === this.name, "session signed for wrong spec")

			const verifiedAddress = verifySessionSignature(session)
			assert(verifiedAddress.toLowerCase() === session.payload.from.toLowerCase(), "session signed by wrong address")

			const sessionKey = Core.getSessionKey(session.payload.session_public_key)
			const existingRecord = await this.store.getSession(sessionKey)
			if (existingRecord === null) {
				await this.store.insertSession(sessionKey, session)
				this.dispatchEvent(new CustomEvent("session", { detail: session.payload }))
			}
		})
	}

	public static readonly actionKeyPrefix = "a:"
	public static getActionKey(hash: string): string {
		assert(hash.startsWith("0x"), "internal error: corrupt action key found in message store")
		return Core.actionKeyPrefix + hash.slice(2)
	}

	public static readonly sessionKeyPrefix = "s:"
	public static getSessionKey(sessionPublicKey: string): string {
		assert(sessionPublicKey.startsWith("0x"), "internal error: corrupt session key found in message store")
		return Core.sessionKeyPrefix + sessionPublicKey.slice(2)
	}

	// Utilities

	private globalHandleCache: Record<string, QuickJSHandle> = {}

	/**
	 * Core.get is a utility for accessing global variables inside
	 * the QuickJS context. Call it with period-separated paths
	 * like "Function.prototype.toString" or "Object.hasOwnProperty".
	 */
	private get(path: string): QuickJSHandle {
		if (path in this.globalHandleCache) {
			return this.globalHandleCache[path]
		}

		const elements = path.split(".")
		const prop = elements.pop()
		assert(prop !== undefined)

		const object = elements.length > 0 ? this.get(elements.join(".")) : this.context.global
		const handle = this.context.getProp(object, prop)
		this.globalHandleCache[path] = handle

		return handle
	}

	private call(fn: string, thisArg: null | QuickJSHandle, ...args: QuickJSHandle[]): QuickJSHandle {
		const fnHandle = this.get(fn)
		thisArg = thisArg ?? this.context.null
		const result = this.context.callFunction(fnHandle, thisArg, ...args)
		if (isFail(result)) {
			console.error("[canvas-core]", result.error.consume(this.context.dump))
			throw new Error("Interal error: Core.call failed")
		}
		return result.value
	}

	/**
	 * composes external JSON.stringify with internal JSON.parse
	 * @param jsonValue any JSON value
	 * @returns a QuickJS handle
	 */
	private wrapJSON = (jsonValue: JSONValue): QuickJSHandle => {
		return this.context
			.newString(JSON.stringify(jsonValue))
			.consume((stringHandle) => this.call("JSON.parse", null, stringHandle))
	}

	/**
	 * composes internal JSON.stringify with external JSON.parse
	 * @param handle a QuickJS handle of a JSON value
	 * @returns the unwrapped JSON value
	 */
	private unwrapJSON = (handle: QuickJSHandle): JSONValue => {
		return JSON.parse(this.call("JSON.stringify", null, handle).consume(this.context.getString))
	}

	/**
	 * Wrap an object outside a QuickJS VM by one level,
	 * returning a QuickJSHandle in the host environment.
	 * Core.wrapObject disposes all of its handle values.
	 */
	private wrapObject = (object: Record<string, QuickJSHandle>): QuickJSHandle => {
		const objectHandle = this.context.newObject()
		for (const [key, valueHandle] of Object.entries(object)) {
			this.context.setProp(objectHandle, key, valueHandle)
			valueHandle.dispose()
		}

		return objectHandle
	}

	/**
	 * Unwrap an object inside a QuickJS VM by one level,
	 * returning a Record<string, QuickJSHandle> in the host environment.
	 * Core.unwrapObject does NOT dispose of the original handle.
	 */
	private unwrapObject = (handle: QuickJSHandle): Record<string, QuickJSHandle> => {
		const object: Record<string, QuickJSHandle> = {}
		for (const keyHandle of this.call("Object.keys", null, handle).consume(this.unwrapArray)) {
			const valueHandle = this.context.getProp(handle, keyHandle)
			const key = keyHandle.consume(this.context.getString)
			object[key] = valueHandle
		}

		return object
	}

	/**
	 * Wrap an array outside a QuickJS VM by one level,
	 * returning a QuickJSHandle in the host environment.
	 * Core.wrapArray disposes all of its handle elements.
	 */
	private wrapArray = (array: QuickJSHandle[]): QuickJSHandle => {
		const arrayHandle = this.context.newArray()
		for (const elementHandle of array) {
			this.call("Array.prototype.push", arrayHandle, elementHandle).dispose()
			elementHandle.dispose()
		}

		return arrayHandle
	}

	/**
	 * Unwrap an array inside a QuickJS VM by one level,
	 * returning a QuickJSHandle[] in the host environment.
	 * Core.unwrapArray does NOT dispose of the original handle.
	 */
	private unwrapArray = (handle: QuickJSHandle): QuickJSHandle[] => {
		const length = this.context.getProp(handle, "length").consume(this.context.getNumber)
		const array = new Array<QuickJSHandle>(length)
		for (let index = 0; index < length; index++) {
			const indexHandle = this.context.newNumber(index)
			array[index] = this.context.getProp(handle, indexHandle)
			indexHandle.dispose()
		}

		return array
	}
}

const assertPattern = (value: string, pattern: RegExp, message: string) =>
	assert(pattern.test(value), `${message}: ${JSON.stringify(value)} does not match pattern ${pattern.source}`)

/**
 * Resolving promises inside QuickJS is tricky because you have to call
 * runtime.executePendingJobs() to get the promise to resolve, so you
 * can't use await syntax even though vm.resolvePromise returns a
 * native Promise. This is a utility method that lets you use await.
 */
async function resolvePromise(context: QuickJSContext, promise: QuickJSHandle): Promise<VmCallResult<QuickJSHandle>> {
	return new Promise((resolve, reject) => {
		context.resolvePromise(promise).then(resolve).catch(reject)
		context.runtime.executePendingJobs()
	})
}

/**
 * Load the exports of a module as an object and return it as a handle.
 */
async function loadModule(context: QuickJSContext, moduleName: string, moduleSource: string): Promise<QuickJSHandle> {
	context.runtime.setModuleLoader((name) => {
		if (name === moduleName) {
			return moduleSource
		} else {
			throw new Error("module imports are not allowed")
		}
	})

	const moduleResult = context.evalCode(`import("${moduleName}")`)
	const modulePromise = context.unwrapResult(moduleResult)
	const moduleExports = await resolvePromise(context, modulePromise).then(context.unwrapResult)
	modulePromise.dispose()
	context.runtime.removeModuleLoader()
	return moduleExports
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
