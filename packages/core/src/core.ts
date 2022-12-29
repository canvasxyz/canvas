import assert from "node:assert"
import path from "node:path"

import chalk from "chalk"
import PQueue from "p-queue"
import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"
import { createLibp2p, Libp2p } from "libp2p"

import {
	Action,
	ActionPayload,
	Session,
	SessionPayload,
	ModelValue,
	BlockProvider,
	Chain,
	ChainId,
	Block,
} from "@canvas-js/interfaces"

import { verifyActionSignature, verifySessionSignature } from "@canvas-js/verifiers"

import { actionType, sessionType } from "./codecs.js"
import { toHex, BlockResolver, signalInvalidType, CacheMap } from "./utils.js"
import { normalizeAction, fromBinaryAction, fromBinarySession, normalizeSession, BinaryMessage } from "./encoding.js"
import { VM } from "./vm/index.js"
import { MessageStore } from "./messageStore.js"
import { ModelStore } from "./modelStore.js"

import * as constants from "./constants.js"
import { getLibp2pInit } from "./libp2p.js"
import { Source } from "./source.js"

export interface CoreConfig extends CoreOptions {
	// pass `null` to run in memory
	directory: string | null
	// defaults to ipfs:// hash of spec
	uri?: string
	spec: string
	libp2p?: Libp2p
	providers?: Record<string, BlockProvider>
	// defaults to fetching each block from the provider with no caching
	blockResolver?: BlockResolver
}

export interface CoreOptions {
	unchecked?: boolean
	verbose?: boolean
	offline?: boolean
}

interface CoreEvents {
	close: Event
	error: Event
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

export class Core extends EventEmitter<CoreEvents> {
	public readonly modelStore: ModelStore
	public readonly messageStore: MessageStore

	public readonly recentGossipPeers = new CacheMap<string, { lastSeen: number }>(1000)
	public readonly recentSyncPeers = new CacheMap<string, { lastSeen: number }>(1000)

	private readonly source: Source | null = null
	private readonly queue: PQueue = new PQueue({ concurrency: 1 })

	public static async initialize({ directory, uri, spec, libp2p, providers, blockResolver, ...options }: CoreConfig) {
		const cid = await Hash.of(spec).then(CID.parse)
		if (uri === undefined) {
			uri = `ipfs://${cid.toString()}`
		}

		const vm = await VM.initialize(uri, spec, providers || {})

		if (blockResolver === undefined) {
			blockResolver = async (chain, chainId, blockhash) => {
				const key = `${chain}:${chainId}`
				assert(providers !== undefined && key in providers, `no provider for ${chain}:${chainId}`)
				return await providers[key].getBlock(blockhash)
			}
		}

		if (options.offline) {
			return new Core(directory, uri, cid, spec, vm, null, blockResolver, options)
		} else if (libp2p === undefined) {
			const peerId = await createEd25519PeerId()
			const libp2p = await createLibp2p(getLibp2pInit(peerId))
			await libp2p.start()
			const core = new Core(directory, uri, cid, spec, vm, libp2p, blockResolver, options)
			core.addEventListener("close", () => libp2p.stop())
			return core
		} else {
			return new Core(directory, uri, cid, spec, vm, libp2p, blockResolver, options)
		}
	}

	private constructor(
		public readonly directory: string | null,
		public readonly uri: string,
		public readonly cid: CID,
		public readonly spec: string,
		public readonly vm: VM,
		public readonly libp2p: Libp2p | null,
		private readonly blockResolver: BlockResolver,
		private readonly options: CoreOptions
	) {
		super()

		this.options = options

		const modelDatabasePath = directory && path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
		this.modelStore = new ModelStore(modelDatabasePath, vm, { verbose: options.verbose })

		const messageDatabasePath = directory && path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME)
		this.messageStore = new MessageStore(uri, messageDatabasePath, [], { verbose: options.verbose })

		if (directory !== null) {
			this.source = Source.initialize({
				path: path.resolve(directory, constants.MST_FILENAME),
				cid,
				applyMessage: this.applyMessage,
				messageStore: this.messageStore,
				libp2p,
				recentGossipPeers: this.recentGossipPeers,
				recentSyncPeers: this.recentSyncPeers,
				verbose: options.verbose,
				offline: options.offline,
			})
		}
	}

	public async close() {
		await this.queue.onIdle()

		this.vm.dispose()
		this.messageStore.close()
		this.modelStore.close()

		if (this.source !== null) {
			await this.source.close()
		}

		this.dispatchEvent(new Event("close"))
	}

	public async getRoute(route: string, params: Record<string, string>): Promise<Record<string, ModelValue>[]> {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		return this.modelStore.getRoute(route, params)
	}

	/**
	 * Executes an action.
	 */
	public async applyAction(action: Action): Promise<{ hash: string }> {
		assert(actionType.is(action), "Invalid action value")

		const [hash, message, data] = normalizeAction(action)

		const existingRecord = this.messageStore.getActionByHash(hash)
		if (existingRecord !== null) {
			return { hash: toHex(hash) }
		}

		await this.applyMessage(hash, message)

		if (this.source !== null) {
			this.source.insertMessage(hash, message)
			await this.source.publishMessage(hash, data)
		}

		return { hash: toHex(hash) }
	}

	/**
	 * Create a new session.
	 */
	public async applySession(session: Session): Promise<{ hash: string }> {
		assert(sessionType.is(session), "invalid session")

		const [hash, message, data] = normalizeSession(session)

		const existingRecord = this.messageStore.getSessionByHash(hash)
		if (existingRecord !== null) {
			return { hash: toHex(hash) }
		}

		await this.applyMessage(hash, message)

		if (this.source !== null) {
			this.source.insertMessage(hash, message)
			await this.source.publishMessage(hash, data)
		}

		return { hash: toHex(hash) }
	}

	/**
	 * Apply a message.
	 * For actions: validate, execute, apply effects, insert into message store.
	 * For sessions: validate, insert into message store.
	 * This method is also passed to Source as the callback for GossipSub and MST sync messages.
	 */
	private applyMessage = async (hash: Buffer, message: BinaryMessage) => {
		const id = toHex(hash)
		if (message.type === "action") {
			const action = fromBinaryAction(message)
			await this.validateAction(action)

			if (this.options.verbose) {
				console.log(chalk.green(`[canvas-core] Applying action ${id}`), action)
			}

			// only execute one action at a time.
			await this.queue.add(async () => {
				const effects = await this.vm.execute(id, action.payload)
				this.modelStore.applyEffects(action.payload, effects)
			})

			this.messageStore.insertAction(hash, message)

			this.dispatchEvent(new CustomEvent("action", { detail: action.payload }))
		} else if (message.type === "session") {
			const session = fromBinarySession(message)
			await this.validateSession(session)

			if (this.options.verbose) {
				console.log(chalk.green(`[canvas-core] Applying session ${id}`), session)
			}

			this.messageStore.insertSession(hash, message)

			this.dispatchEvent(new CustomEvent("session", { detail: session.payload }))
		} else {
			signalInvalidType(message)
		}
	}

	private async validateAction(action: Action) {
		const { timestamp, spec, blockhash, chain, chainId } = action.payload
		const fromAddress = action.payload.from

		assert(spec === this.uri, "action signed for wrong spec")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the action was signed with a valid, recent block
			assert(blockhash, "action is missing block data")
			await this.validateBlock({ blockhash, chain, chainId })
		}

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const { session: binarySession } = this.messageStore.getSessionByAddress(chain, chainId, action.session)
			assert(binarySession !== null, "session not found")
			const session = fromBinarySession(binarySession)
			assert(session.payload.chain === action.payload.chain, "session and action chains must match")
			assert(session.payload.chainId === action.payload.chainId, "session and action chain IDs must match")
			assert(session.payload.timestamp + session.payload.duration > timestamp, "session expired")
			assert(session.payload.timestamp <= timestamp, "session timestamp must precede action timestamp")

			assert(session.payload.spec === spec, "action referenced a session for the wrong spec")
			assert(
				session.payload.from === fromAddress,
				"invalid session key (action.payload.from and session.payload.from do not match)"
			)

			const verifiedAddress = await verifyActionSignature(action)
			assert(verifiedAddress === action.session, "invalid action signature (recovered address does not match)")
			assert(verifiedAddress === session.payload.address, "invalid action signature (action, session do not match)")
			assert(action.payload.spec === session.payload.spec, "action signed for wrong spec")
		} else {
			const verifiedAddress = await verifyActionSignature(action)
			assert(verifiedAddress === fromAddress, "action signed by wrong address")
		}
	}

	private async validateSession(session: Session) {
		const { from, spec, timestamp, blockhash, chain, chainId } = session.payload
		assert(spec === this.uri, "session signed for wrong spec")

		const verifiedAddress = await verifySessionSignature(session)
		assert(verifiedAddress === from, "session signed by wrong address")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "session timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "session timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the session was signed with a valid, recent block
			assert(blockhash, "session is missing block data")
			await this.validateBlock({ blockhash, chain, chainId })
		}
	}

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	private async validateBlock({ chain, chainId, blockhash }: { chain: Chain; chainId: ChainId; blockhash: string }) {
		assert(this.blockResolver !== null, "missing blockResolver")
		const block = await this.blockResolver(chain, chainId, blockhash)
		// TODO: add blocknums to messages, verify blocknum and blockhash match
	}

	public async getLatestBlock({ chain, chainId }: { chain: Chain; chainId: ChainId }): Promise<Block> {
		return this.blockResolver(chain, chainId, "latest")
	}
}
