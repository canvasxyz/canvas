import assert from "node:assert"

import { QuickJSWASMModule } from "quickjs-emscripten"

import PQueue from "p-queue"
import Hash from "ipfs-only-hash"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"

import {
	Action,
	ActionPayload,
	Block,
	Session,
	SessionPayload,
	verifyActionSignature,
	verifySessionSignature,
	ModelValue,
	Model,
	ContractMetadata,
	Chain,
} from "@canvas-js/interfaces"

import { ModelStore } from "./models/index.js"
import { actionType, sessionType, chainType, chainIdType } from "./codecs.js"
import { getActionHash, getSessionhash, mapEntries, signalInvalidType } from "./utils.js"
import { VM } from "./vm/index.js"
import { MessageStore } from "./messages/index.js"

export interface CoreConfig {
	name: string
	directory: string | null
	store: ModelStore
	spec: string
	quickJS: QuickJSWASMModule
	replay?: boolean
	verbose?: boolean
	unchecked?: boolean
	rpc?: Partial<Record<Chain, Record<string, string>>>
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
	private static readonly cidPattern = /^Qm[a-zA-Z0-9]{44}$/
	public static async initialize(config: CoreConfig): Promise<Core> {
		const { store, directory, name, spec, verbose, unchecked, rpc, replay, quickJS } = config

		if (verbose) {
			console.log(`[canvas-core] Initializing core ${name}`)
		}

		if (Core.cidPattern.test(name)) {
			const cid = await Hash.of(spec)
			assert(cid === name, "Core.name is not equal to the hash of the provided spec.")
		}

		const { vm, models, actionParameters } = await VM.initialize(name, spec, quickJS, { verbose })

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

		await store.initialize(models)

		const log = new MessageStore(name, directory, { verbose })

		// const core = new Core(name, vm, models, routes, actionParameters, store, log, { verbose, unchecked, rpc })
		const core = new Core(name, vm, models, actionParameters, store, log, { verbose, unchecked, rpc })

		if (replay) {
			if (verbose) {
				console.log(`[canvas-core] Replaying action log...`)
			}

			let i = 0
			for await (const [id, action] of log.getActionStream()) {
				if (!actionType.is(action)) {
					console.error("[canvas-core]", action)
					throw new Error("Invalid action value in action log")
				}

				const effects = await vm.execute(id, action.payload)
				await store.applyEffects(action.payload, effects)
				i++
			}

			if (verbose) {
				console.log(`[canvas-core] Successfully replayed all ${i} entries from the action log.`)
			}
		}

		if (verbose) {
			console.log(`[canvas-core] Successfully initialized core ${config.name}`)
		}

		return core
	}

	// public readonly routeParameters: Record<string, string[]>

	// public readonly contractParameters: Record<string, { metadata: ContractMetadata; contract: ethers.Contract }>
	// // TODO: remove contractRpcProviders, we don't need two sets of providers
	// public readonly contractRpcProviders: Record<string, ethers.providers.JsonRpcProvider>
	// public readonly rpcProviders: Partial<Record<Chain, Record<string, ethers.providers.JsonRpcProvider>>>

	// public readonly blockCache: Record<string, Record<string, BlockInfo>>
	// public readonly blockCacheRecents: Record<string, string[]>
	// public readonly blockCacheMostRecentTimestamp: Record<string, number>

	private readonly queue: PQueue

	private constructor(
		public readonly name: string,
		public readonly vm: VM,
		public readonly models: Record<string, Model>,
		// public readonly routes: Record<string, string>,
		public readonly actionParameters: Record<string, string[]>,
		public readonly store: ModelStore,
		public readonly log: MessageStore,
		private readonly options: {
			verbose?: boolean
			unchecked?: boolean
			rpc?: Partial<Record<Chain, Record<string, string>>>
		}
	) {
		super()
		this.queue = new PQueue({ concurrency: 1 })

		// const routeNamePattern = /^(\/:?[a-z_]+)+$/
		// const routeParameterPattern = /:([a-zA-Z0-9_]+)/g
		// this.routeParameters = {}
		// for (const route of Object.keys(routes)) {
		// 	assertPattern(route, routeNamePattern, "invalid route name")
		// 	this.routeParameters[route] = []
		// 	for (const [_, param] of route.matchAll(routeParameterPattern)) {
		// 		this.routeParameters[route].push(param)
		// 	}
		// }

		// set up cache and rpc
		// this.rpcProviders = {}
		// this.blockCache = {}
		// this.blockCacheRecents = {}
		// this.blockCacheMostRecentTimestamp = {}
		// for (const [chain, chainRpcs] of Object.entries(this.rpc)) {
		// 	this.rpcProviders[chain as Chain] = {}
		// 	for (const [chainId, rpcUrl] of Object.entries(chainRpcs)) {
		// 		const providers = this.rpcProviders[chain as Chain]
		// 		if (!providers) continue
		// 		if (this.options.unchecked) continue

		// 		// set up each chain's rpc and blockhash cache
		// 		const key = chain + ":" + chainId
		// 		this.blockCache[key] = {}
		// 		this.blockCacheRecents[key] = []

		// 		// TODO: consider using JsonRpcBatchProvider
		// 		providers[chainId] = new ethers.providers.JsonRpcProvider(rpcUrl.toString())
		// 		providers[chainId].getBlockNumber().then(async (currentBlock) => {
		// 			const updateCache = async (blocknum: number) => {
		// 				const block = await providers[chainId].getBlock(blocknum)
		// 				const info = { number: block.number, timestamp: block.timestamp }
		// 				this.blockCacheMostRecentTimestamp[key] = block.timestamp

		// 				// keep up to 128 past blocks
		// 				const CACHE_SIZE = 128
		// 				this.blockCache[key][block.hash] = info
		// 				this.blockCacheRecents[key].push(block.hash)
		// 				if (this.blockCacheRecents[key].length > CACHE_SIZE) {
		// 					const evicted = this.blockCacheRecents[key].shift()
		// 					if (evicted) delete this.blockCache[key][evicted]
		// 				}
		// 			}

		// 			// listen for new blocks
		// 			providers[chainId].on("block", updateCache)

		// 			// warm up cache with current block. this must happen *after* setting up the listener
		// 			const block = await providers[chainId].getBlock(currentBlock)
		// 			const info = { number: block.number, timestamp: block.timestamp }

		// 			this.blockCache[key][block.hash] = info
		// 			this.blockCacheRecents[key].unshift(block.hash)
		// 		})
		// 	}
		// }

		// parse and validate contracts
		// this.contractParameters = {}
		// this.contractRpcProviders = {}
		// if (contractsHandle !== undefined) {
		// 	const contractHandles = contractsHandle.consume(this.unwrapObject)
		// 	const contracts = mapEntries(contractHandles, (contract, contractHandle) => {
		// 		return contractHandle.consume(this.unwrapObject) // TODO: could be number?
		// 	})

		// 	const contractNamePattern = /^[a-zA-Z]+$/
		// 	for (const name of Object.keys(contracts)) {
		// 		assertPattern(name, contractNamePattern, "invalid contract name")
		// 		const chain = contracts[name].chain.consume(this.context.getString)
		// 		const chainId = contracts[name].chainId.consume(this.context.getNumber)
		// 		const address = contracts[name].address.consume(this.context.getString)
		// 		const abi = contracts[name].abi.consume(this.unwrapArray).map((item) => item.consume(this.context.getString))

		// 		assert(chainType.is(chain), "invalid chain")
		// 		assert(chainIdType.is(chainId), "invalid chain id")

		// 		let rpcUrl
		// 		if (!this.rpc[chain] || !this.rpc[chain][chainId]) {
		// 			if (!this.unchecked)
		// 				throw new Error(
		// 					`[canvas-core] This spec needs an rpc endpoint for on-chain data (${chain}, chain id ${chainId}). Specify one with e.g. "canvas run --chain-rpc eth 1 https://mainnet.infura.io/v3/[APPID]".`
		// 				)
		// 			rpcUrl = ""
		// 		} else {
		// 			rpcUrl = this.rpc[chain][chainId]
		// 		}

		// 		let provider
		// 		if (!this.contractRpcProviders[rpcUrl]) {
		// 			provider = new ethers.providers.JsonRpcProvider(rpcUrl)
		// 			this.contractRpcProviders[rpcUrl] = provider
		// 		} else {
		// 			provider = this.contractRpcProviders[rpcUrl]
		// 		}

		// 		this.contractParameters[name] = {
		// 			metadata: { chain, chainId, address, abi },
		// 			contract: new ethers.Contract(address, abi, provider),
		// 		}
		// 	}
		// }
	}

	public async onIdle(): Promise<void> {
		await this.queue.onIdle()
	}

	public async close() {
		if (this.options.verbose) {
			console.log("[canvas-core] Closing...")
		}

		await this.queue.onEmpty()

		this.vm.dispose()
		this.store.close()
		this.dispatchEvent(new Event("close"))
	}

	// public async getRoute(route: string, params: Record<string, ModelValue> = {}): Promise<Record<string, ModelValue>[]> {
	// 	if (this.options.verbose) {
	// 		console.log("[canvas-core] getRoute:", route, params)
	// 	}

	// 	return this.store.getRoute(route, params)
	// }

	private static boundsCheckLowerLimit = new Date("2020").valueOf()
	private static boundsCheckUpperLimit = new Date("2070").valueOf()

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	public async verifyBlock(blockInfo: Block) {
		// const { chain, chainId, blocknum, blockhash, timestamp } = blockInfo
		// const rpcProviders = this.rpcProviders[chain]
		// // TODO: declare the chains and chainIds that each spec will require upfront
		// // Find the block via RPC.
		// assert(rpcProviders !== undefined, `action signed with unsupported chain: ${chain}`)
		// assert(rpcProviders[chainId] !== undefined, `action signed with unsupported chainId: ${chainId}`)
		// let block
		// if (this.blockCache[chain + ":" + chainId]) {
		// 	block = this.blockCache[chain + ":" + chainId][blockhash]
		// }
		// if (!block) {
		// 	try {
		// 		if (this.options.verbose) {
		// 			console.log(`[canvas-core] fetching block ${blockInfo.blockhash} for ${chain}:${chainId}`)
		// 		}
		// 		block = await rpcProviders[chainId].getBlock(blockInfo.blockhash)
		// 		this.blockCache[chain + ":" + chainId][blockhash] = block
		// 	} catch (err) {
		// 		// TODO: catch rpc errors and identify those separately vs invalid blockhash errors
		// 		throw new Error("action signed with invalid block hash")
		// 	}
		// }
		// // check the block retrieved from RPC matches metadata from the user
		// assert(block, "could not find a valid block:" + JSON.stringify(block))
		// assert(block.number === blocknum, "action/session provided with invalid block number")
		// assert(block.timestamp === timestamp, "action/session provided with invalid timestamp")
		// // check the block was recent
		// const maxDelay = 30 * 60 // limit propagation to 30 minutes
		// assert(
		// 	timestamp >= this.blockCacheMostRecentTimestamp[chain + ":" + chainId] - maxDelay,
		// 	"action must be signed with a recent timestamp, within " + maxDelay + "s of the last seen block"
		// )
	}

	/**
	 * Executes an action.
	 */
	public apply(action: Action): Promise<{ hash: string }> {
		if (this.options.verbose) {
			console.log("[canvas-core] apply action:", JSON.stringify(action))
		}

		return this.queue.add(async () => {
			// check type of action
			assert(actionType.is(action), "Invalid action value")

			// hash the action
			const hash = await getActionHash(action)

			// check if the action has already been applied
			const existingRecord = await this.log.getActionByHash(hash)
			if (existingRecord !== null) {
				return { hash }
			}

			await this.validateAction(action)

			// set up hooks available to action processor
			// this.setupGlobals(action.payload.block)

			// execute the action
			const effects = await this.vm.execute(hash, action.payload)
			await this.log.insertAction(hash, action)
			await this.store.applyEffects(action.payload, effects)

			this.dispatchEvent(new CustomEvent("action", { detail: action.payload }))

			return { hash }
		})
	}

	private async validateAction(action: Action) {
		const { timestamp, block, spec, from } = action.payload
		assert(spec === this.name, "session signed for wrong spec")

		// check the timestamp bounds
		assert(timestamp > Core.boundsCheckLowerLimit, "action timestamp too far in the past")
		assert(timestamp < Core.boundsCheckUpperLimit, "action timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the action was signed with a valid, recent block
			assert(block !== undefined, "action missing block data")
			await this.verifyBlock(block)
		}

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const session = await this.log.getSessionByAddress(action.session)
			assert(session !== null, "session not found")
			assert(session.payload.timestamp + session.payload.duration > timestamp, "session expired")
			assert(session.payload.timestamp <= timestamp, "session timestamp must precede action timestamp")

			assert(session.payload.spec === spec, "action referenced a session for the wrong spec")

			assert(
				session.payload.from.toLowerCase() === from.toLowerCase(),
				"invalid session key (action.payload.from and session.payload.from do not match)"
			)

			const verifiedAddress = verifyActionSignature(action)
			assert(
				verifiedAddress.toLowerCase() === action.session.toLowerCase(),
				"invalid action signature (recovered address does not match)"
			)
			assert(
				verifiedAddress.toLowerCase() === session.payload.address.toLowerCase(),
				"invalid action signature (action, session do not match)"
			)

			assert(action.payload.spec === session.payload.spec, "action signed for wrong spec")
		} else {
			const verifiedAddress = verifyActionSignature(action)
			assert(verifiedAddress.toLowerCase() === action.payload.from.toLowerCase(), "action signed by wrong address")
		}
	}

	/**
	 * Set up function calls available to the QuickJS VM executor.
	 * Used by `.apply()`.
	 */
	// private setupGlobals(block?: Block): void {
	// 	const globalHandles: Record<string, QuickJSHandle> = {}

	// 	if (block !== undefined) {
	// 		// contract:
	// 		globalHandles.contract = this.context.newFunction("contract", (nameHandle: QuickJSHandle) => {
	// 			assert(this.context.typeof(nameHandle) === "string", "name must be a string")
	// 			const name = this.context.getString(nameHandle)
	// 			const contract = this.contractParameters[name].contract
	// 			const { address, abi } = this.contractParameters[name].metadata
	// 			const deferred = this.context.newPromise()
	// 			if (this.verbose) console.log("[canvas-vm] using contract:", name, address)

	// 			// produce an object that supports the contract's function calls
	// 			const wrapper: Record<string, QuickJSHandle> = {}
	// 			for (const key in contract.functions) {
	// 				if (typeof key !== "string") continue
	// 				if (key.indexOf("(") !== -1) continue

	// 				wrapper[key] = this.context.newFunction(key, (...argHandles: any[]) => {
	// 					const args = argHandles.map(this.context.dump)
	// 					if (this.verbose) {
	// 						const call = chalk.green(`${name}.${key}(${args.join(",")})`)
	// 						console.log(`[canvas-vm] contract: ${call} at block ${block.blocknum} ${block.blockhash.slice(0, 5)}`)
	// 					}

	// 					contract[key]
	// 						.apply(this, args.concat({ blockTag: block.blocknum }))
	// 						.then((result: any) => {
	// 							deferred.resolve(this.context.newString(result.toString()))
	// 						})
	// 						.catch((err: Error) => {
	// 							console.error("[canvas-vm] contract call error:", err.message)
	// 							deferred.reject(this.context.newString(err.message))
	// 						})
	// 					deferred.settled.then(this.runtime.executePendingJobs)
	// 					return deferred.handle
	// 				})
	// 			}
	// 			return this.wrapObject(wrapper)
	// 		})
	// 	}

	// 	const globals = this.wrapObject(globalHandles)
	// 	this.call("Object.assign", null, this.context.global, globals).dispose()
	// 	globals.dispose()
	// }

	/**
	 * Create a new session.
	 */
	public session(session: Session): Promise<{ hash: string }> {
		if (this.options.verbose) {
			console.log("[canvas-core] apply session:", JSON.stringify(session))
		}

		return this.queue.add(async () => {
			assert(sessionType.is(session), "invalid session")

			const hash = await getSessionhash(session)

			const existingRecord = await this.log.getSessionByHash(hash)
			if (existingRecord !== null) {
				return { hash }
			}

			await this.validateSession(session)

			await this.log.insertSession(hash, session)

			this.dispatchEvent(new CustomEvent("session", { detail: session.payload }))

			return { hash }
		})
	}

	private async validateSession(session: Session) {
		const { from, spec, timestamp, block } = session.payload
		assert(spec === this.name, "session signed for wrong spec")

		const verifiedAddress = verifySessionSignature(session)
		assert(verifiedAddress.toLowerCase() === from.toLowerCase(), "session signed by wrong address")

		// check the timestamp bounds
		assert(timestamp > Core.boundsCheckLowerLimit, "session timestamp too far in the past")
		assert(timestamp < Core.boundsCheckUpperLimit, "session timestamp too far in the future")

		// check the session was signed with a valid, recent block
		if (!this.options.unchecked) {
			assert(block !== undefined, "session missing block info")
			await this.verifyBlock(block)
		}
	}
}

const assertPattern = (value: string, pattern: RegExp, message: string) =>
	assert(pattern.test(value), `${message}: ${JSON.stringify(value)} does not match pattern ${pattern.source}`)
