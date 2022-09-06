import assert from "node:assert"

import { ethers } from "ethers"
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
import { getActionHash, getSessionhash, mapEntries, signalInvalidType, CacheMap } from "./utils.js"
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
		const { store: modelStore, directory, name, spec, verbose, unchecked, rpc, replay, quickJS } = config

		if (verbose) {
			console.log(`[canvas-core] Initializing core ${name}`)
		}

		if (Core.cidPattern.test(name)) {
			const cid = await Hash.of(spec)
			assert(cid === name, "Core.name is not equal to the hash of the provided spec.")
		}

		const { vm, exports } = await VM.initialize(name, spec, quickJS, { verbose })
		const { models, actionParameters, database, routes, routeParameters } = exports

		if (database !== undefined) {
			assert(
				modelStore.identifier === database,
				`spec requires a ${database} model store, but the core was initialized with a ${modelStore.identifier} model store`
			)
		}

		await modelStore.initialize(models, routes)

		const messageStore = new MessageStore(name, directory, { verbose })

		const core = new Core(
			name,
			vm,
			models,
			actionParameters,
			routes || {},
			routeParameters || {},
			modelStore,
			messageStore,
			rpc || {},
			{ verbose, unchecked }
		)

		if (replay) {
			if (verbose) {
				console.log(`[canvas-core] Replaying action log...`)
			}

			let i = 0
			for await (const [id, action] of messageStore.getActionStream()) {
				if (!actionType.is(action)) {
					console.error("[canvas-core]", action)
					throw new Error("Invalid action value in action log")
				}

				const effects = await vm.execute(id, action.payload)
				await modelStore.applyEffects(action.payload, effects)
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

	// public readonly contractParameters: Record<string, { metadata: ContractMetadata; contract: ethers.Contract }>
	// TODO: remove contractRpcProviders, we don't need two sets of providers
	// public readonly contractRpcProviders: Record<string, ethers.providers.JsonRpcProvider>
	private readonly providers: Record<string, ethers.providers.JsonRpcProvider> = {}
	// private readonly rpcProviders: Partial<Record<Chain, Record<string, ethers.providers.JsonRpcProvider>>> = {}
	private readonly blockCache: Record<string, CacheMap<string, BlockInfo>> = {}
	// private readonly blockCacheRecents: Record<string, string[]> = {}
	private readonly blockCacheMostRecentTimestamp: Record<string, number> = {}

	private readonly queue: PQueue

	private constructor(
		public readonly name: string,
		public readonly vm: VM,
		public readonly models: Record<string, Model>,
		public readonly actionParameters: Record<string, string[]>,
		public readonly routes: Record<string, string>,
		public readonly routeParameters: Record<string, string[]>,
		public readonly modelStore: ModelStore,
		public readonly messageStore: MessageStore,
		public readonly rpc: Partial<Record<Chain, Record<string, string>>>,
		private readonly options: {
			verbose?: boolean
			unchecked?: boolean
		}
	) {
		super()
		this.queue = new PQueue({ concurrency: 1 })

		// keep up to 128 past blocks
		const CACHE_SIZE = 128

		// set up rpc providers and block caches
		for (const [chain, chainRpcs] of Object.entries(this.rpc)) {
			for (const [chainId, rpcUrl] of Object.entries(chainRpcs)) {
				if (this.options.unchecked) continue

				// set up each chain's rpc and blockhash cache
				const key = `${chain}:${chainId}`
				this.blockCache[key] = new CacheMap(CACHE_SIZE)

				// TODO: consider using JsonRpcBatchProvider
				this.providers[key] = new ethers.providers.JsonRpcProvider(rpcUrl)
				this.providers[key].getBlockNumber().then(async (currentBlockNumber) => {
					const updateCache = async (blocknum: number) => {
						const { timestamp, hash, number } = await this.providers[key].getBlock(blocknum)
						if (this.options.verbose) {
							console.log(`[canavs-core] Caching ${key} block ${number} (${hash})`)
						}

						this.blockCacheMostRecentTimestamp[key] = timestamp
						this.blockCache[key].add(hash, { number, timestamp })
					}

					// listen for new blocks
					this.providers[key].on("block", updateCache)

					// warm up cache with current block. this must happen *after* setting up the listener
					const block = await this.providers[key].getBlock(currentBlockNumber)
					const info = { number: block.number, timestamp: block.timestamp }

					this.blockCache[key].add(block.hash, info)
				})
			}
		}

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
		for (const provider of Object.values(this.providers)) {
			provider.removeAllListeners("block")
		}

		await this.queue.onEmpty()

		// TODO: think about when and how to close the model store.
		// Right now neither model store implementation actually needs closing.

		this.vm.dispose()
		this.dispatchEvent(new Event("close"))
	}

	private static boundsCheckLowerLimit = new Date("2020").valueOf()
	private static boundsCheckUpperLimit = new Date("2070").valueOf()

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	public async verifyBlock(blockInfo: Block) {
		const { chain, chainId, blocknum, blockhash, timestamp } = blockInfo
		const provider = this.providers[`${chain}:${chainId}`]

		// TODO: declare the chains and chainIds that each spec will require upfront
		// Find the block via RPC.
		assert(provider !== undefined, `action signed with unsupported chain: ${chain} ${chainId}`)
		let block
		if (this.blockCache[chain + ":" + chainId]) {
			block = this.blockCache[chain + ":" + chainId].get(blockhash)
		}
		if (!block) {
			try {
				if (this.options.verbose) {
					console.log(`[canvas-core] fetching block ${blockInfo.blockhash} for ${chain}:${chainId}`)
				}
				block = await provider.getBlock(blockInfo.blockhash)
				this.blockCache[chain + ":" + chainId].add(blockhash, block)
			} catch (err) {
				// TODO: catch rpc errors and identify those separately vs invalid blockhash errors
				throw new Error("action signed with invalid block hash")
			}
		}

		// check the block retrieved from RPC matches metadata from the user
		assert(block, "could not find a valid block:" + JSON.stringify(block))
		assert(block.number === blocknum, "action/session provided with invalid block number")
		assert(block.timestamp === timestamp, "action/session provided with invalid timestamp")
		// check the block was recent
		const maxDelay = 30 * 60 // limit propagation to 30 minutes
		assert(
			timestamp >= this.blockCacheMostRecentTimestamp[chain + ":" + chainId] - maxDelay,
			"action must be signed with a recent timestamp, within " + maxDelay + "s of the last seen block"
		)
	}

	/**
	 * Executes an action.
	 */
	public apply(action: Action): Promise<{ hash: string }> {
		if (this.options.verbose) {
			console.log("[canvas-core] apply action", action.session, action.signature, action.payload)
		}

		return this.queue.add(async () => {
			// check type of action
			assert(actionType.is(action), "Invalid action value")

			// hash the action
			const hash = await getActionHash(action)

			// check if the action has already been applied
			const existingRecord = await this.messageStore.getActionByHash(hash)
			if (existingRecord !== null) {
				return { hash }
			}

			await this.validateAction(action)

			// set up hooks available to action processor
			// this.setupGlobals(action.payload.block)

			// execute the action
			const effects = await this.vm.execute(hash, action.payload)
			await this.messageStore.insertAction(hash, action)
			await this.modelStore.applyEffects(action.payload, effects)

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
			const session = await this.messageStore.getSessionByAddress(action.session)
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

			const existingRecord = await this.messageStore.getSessionByHash(hash)
			if (existingRecord !== null) {
				return { hash }
			}

			await this.validateSession(session)

			await this.messageStore.insertSession(hash, session)

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

	public async getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]> {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}
		return this.modelStore.getRoute(route, params)
	}
}
