import assert from "node:assert"
import path from "node:path"

import { ethers } from "ethers"

import chalk from "chalk"
import PQueue from "p-queue"
import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

import { EventEmitter, CustomEvent, EventHandler } from "@libp2p/interfaces/events"

import { createLibp2p, type Libp2p } from "libp2p"
import type { FetchService } from "libp2p/fetch"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"

import * as okra from "node-okra"

import {
	Action,
	ActionPayload,
	Block,
	Session,
	SessionPayload,
	verifyActionSignature,
	verifySessionSignature,
	ModelValue,
	Chain,
	Message,
	ChainId,
} from "@canvas-js/interfaces"

import { actionType, sessionType } from "./codecs.js"
import { signalInvalidType, wait, retry, toHex, BlockCache, BlockResolver } from "./utils.js"
import { encodeMessage, decodeMessage, getActionHash, getSessionHash } from "./encoding.js"
import { ModelStore } from "./model-store/index.js"
import { VM } from "./vm/index.js"
import { MessageStore } from "./message-store/store.js"

import * as RPC from "./rpc/index.js"
import { MESSAGE_DATABASE_FILENAME, MODEL_DATABASE_FILENAME, MST_FILENAME } from "./constants.js"
import { createHash } from "node:crypto"
import { getLibp2pInit } from "./libp2p.js"

export interface CoreConfig {
	directory: string | null
	uri: string
	spec: string
	verbose?: boolean
	unchecked?: boolean
	rpc?: Partial<Record<Chain, Record<ChainId, string>>>
	peering?: boolean
	peeringPort?: number
	peerId?: PeerId
}

interface CoreEvents {
	close: Event
	error: Event
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

export class Core extends EventEmitter<CoreEvents> {
	private static readonly ipfsURIPattern = /^ipfs:\/\/([a-zA-Z0-9]+)$/
	private static readonly fileURIPattern = /^file:\/\/(.+)$/
	public static async initialize(config: CoreConfig): Promise<Core> {
		const { directory, uri, verbose, unchecked, rpc, peering, peeringPort: port } = config
		let { spec } = config

		if (verbose) {
			console.log(`[canvas-core] Initializing core ${uri}`)
		}

		assert(Core.ipfsURIPattern.test(uri) || Core.fileURIPattern.test(uri), "Core.uri must be an ipfs:// or file:// URI")

		const cid = await Hash.of(spec).then((cid) => {
			if (Core.ipfsURIPattern.test(uri)) {
				assert(uri === `ipfs://${cid}`, "Core.uri is not equal to the hash of the provided spec.")
			}

			return CID.parse(cid)
		})

		const providers: Record<string, ethers.providers.JsonRpcProvider> = {}
		for (const [chain, chainIds] of Object.entries(rpc || {})) {
			for (const [chainId, url] of Object.entries(chainIds)) {
				const key = `${chain}:${chainId}`
				providers[key] = new ethers.providers.JsonRpcProvider(url)
			}
		}

		const vm = await VM.initialize(uri, spec, providers, { verbose })

		let libp2p: Libp2p | null = null
		if (directory !== null && peering) {
			assert(port !== undefined, "a peeringPort must be provided if peering is enabled")

			const peerId = config.peerId || (await createEd25519PeerId())
			libp2p = await createLibp2p(getLibp2pInit(peerId, port))
			console.log(`[canvas-core] PeerId ${libp2p.peerId.toString()}`)
			await libp2p.start()
		}

		const blockCache = new BlockCache(providers)
		const options = { verbose, unchecked, peering: true, sync: true }
		const core = new Core(directory, uri, cid, spec, vm, libp2p, providers, blockCache, options)
		core.addEventListener("close", () => {
			blockCache.close()
			if (libp2p !== null) {
				libp2p.stop()
			}
		})

		if (verbose) {
			console.log(`[canvas-core] Successfully initialized core ${config.uri}`)
		}

		return core
	}

	public readonly modelStore: ModelStore
	public readonly messageStore: MessageStore
	public readonly mst: okra.Tree | null
	public readonly rpcServer: RPC.Server | null

	private readonly queue: PQueue = new PQueue({ concurrency: 1 })
	private readonly controller = new AbortController()

	private constructor(
		public readonly directory: string | null,
		public readonly uri: string,
		public readonly cid: CID,
		public readonly spec: string,
		public readonly vm: VM,
		public readonly libp2p: Libp2p | null,
		private readonly providers: Record<string, ethers.providers.JsonRpcProvider>,
		private readonly blockResolver: BlockResolver | null,
		private readonly options: {
			verbose?: boolean
			unchecked?: boolean
			peering?: boolean
			sync?: boolean
		}
	) {
		super()

		const modelDatabasePath = directory && path.resolve(directory, MODEL_DATABASE_FILENAME)
		this.modelStore = new ModelStore(modelDatabasePath, vm.models, vm.routes, { verbose: options.verbose })

		const messageDatabasePath = directory && path.resolve(directory, MESSAGE_DATABASE_FILENAME)
		this.messageStore = new MessageStore(uri, messageDatabasePath, { verbose: options.verbose })

		if (directory === null) {
			this.rpcServer = null
			this.mst = null
		} else {
			this.mst = new okra.Tree(path.resolve(directory, MST_FILENAME))
			this.rpcServer = new RPC.Server({ mst: this.mst, messageStore: this.messageStore })
		}

		if (this.libp2p !== null) {
			if (options.peering) {
				this.libp2p.pubsub.subscribe(this.uri)
				this.libp2p.pubsub.addEventListener("message", this.handleMessage)
				console.log(`[canvas-core] Subscribed to pubsub topic ${this.uri}`)
			}

			if (options.sync) {
				this.libp2p.handle(this.syncProtocol, this.handleIncomingStream)
				this.startSyncService()
				this.startPeeringService()
			}

			if (this.uri.startsWith("ipfs://")) {
				const { fetchService } = this.libp2p as Libp2p & { fetchService: FetchService }
				fetchService.registerLookupFunction(`${this.uri}/`, this.fetchLookupFunction)
			}
		}
	}

	private fetchLookupFunction = async (key: string) => {
		if (key === `${this.uri}/`) {
			return Buffer.from(this.spec, "utf-8")
		} else {
			return null
		}
	}

	public get syncProtocol() {
		return `/x/canvas/sync/${this.cid.toString()}`
	}

	public async onIdle(): Promise<void> {
		await this.queue.onIdle()
	}

	public getProvider(chain: Chain, chainId: ChainId): ethers.providers.JsonRpcProvider {
		const key = `${chain}:${chainId}`
		const provider = this.providers[key]
		assert(provider !== undefined, `No provider for ${key}`)
		return provider
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null) {
			this.libp2p.pubsub.unsubscribe(this.uri)
			this.libp2p.pubsub.removeEventListener("message", this.handleMessage)

			if (this.uri.startsWith("ipfs://")) {
				const { fetchService } = this.libp2p as Libp2p & { fetchService: FetchService }
				fetchService.unregisterLookupFunction(`${this.uri}/`, this.fetchLookupFunction)
			}
		}

		await this.queue.onIdle()

		this.vm.dispose()
		this.messageStore.close()
		this.modelStore.close()
		if (this.mst !== null) {
			this.mst.close()
		}

		this.dispatchEvent(new Event("close"))
	}

	private static boundsCheckLowerLimit = new Date("2020").valueOf()
	private static boundsCheckUpperLimit = new Date("2070").valueOf()

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	public async verifyBlock(blockInfo: Block, options: { sync?: boolean }) {
		const { chain, chainId, blocknum, blockhash, timestamp } = blockInfo
		assert(this.blockResolver !== null, "No block resolver provided")
		const block = await this.blockResolver.getBlock(chain, chainId, blockhash)

		// check the block retrieved from RPC matches metadata from the user
		assert(block.number === blocknum, "action/session provided with invalid block number")
		assert(block.timestamp === timestamp, "action/session provided with invalid timestamp")
	}

	/**
	 * Executes an action.
	 */
	public async applyAction(action: Action): Promise<{ hash: string }> {
		assert(actionType.is(action), "Invalid action value")

		const hash = getActionHash(action)

		const existingRecord = this.messageStore.getActionByHash(hash)
		if (existingRecord !== null) {
			return { hash }
		}

		await this.queue.add(() => this.applyActionInternal(hash, action))
		await this.publishMessage(hash, { type: "action", ...action })
		return { hash }
	}

	private async applyActionInternal(hash: string, action: Action, options: { sync?: boolean } = {}) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying action ${hash}`), action)
		}

		await this.validateAction(action, options)

		const effects = await this.vm.execute(hash, action.payload)
		this.messageStore.insertAction(hash, action)
		this.modelStore.applyEffects(action.payload, effects)
		if (this.mst !== null) {
			const hashBuffer = Buffer.from(hash.slice(2), "hex")
			const leafBuffer = Buffer.alloc(14)
			leafBuffer.writeUintBE(action.payload.timestamp * 2 + 1, 0, 6)
			hashBuffer.copy(leafBuffer, 6, 0, 8)
			this.mst.insert(leafBuffer, hashBuffer)
		}

		this.dispatchEvent(new CustomEvent("action", { detail: action.payload }))

		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Successfully applied action ${hash}`))
		}
	}

	private async validateAction(action: Action, options: { sync?: boolean }) {
		const { timestamp, block, spec } = action.payload
		const fromAddress = action.payload.from.toLowerCase()

		assert(spec === this.uri, "action signed for wrong spec")

		// check the timestamp bounds
		assert(timestamp > Core.boundsCheckLowerLimit, "action timestamp too far in the past")
		assert(timestamp < Core.boundsCheckUpperLimit, "action timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the action was signed with a valid, recent block
			assert(block !== undefined, "action missing block data")
			await this.verifyBlock(block, options)
		}

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const sessionAddress = action.session.toLowerCase()
			const { session } = this.messageStore.getSessionByAddress(sessionAddress)
			assert(session !== null, "session not found")
			assert(session.payload.timestamp + session.payload.duration > timestamp, "session expired")
			assert(session.payload.timestamp <= timestamp, "session timestamp must precede action timestamp")

			assert(session.payload.spec === spec, "action referenced a session for the wrong spec")
			assert(
				session.payload.from === fromAddress,
				"invalid session key (action.payload.from and session.payload.from do not match)"
			)

			const verifiedAddress = verifyActionSignature(action)
			assert(verifiedAddress === sessionAddress, "invalid action signature (recovered address does not match)")
			assert(verifiedAddress === session.payload.address, "invalid action signature (action, session do not match)")
			assert(action.payload.spec === session.payload.spec, "action signed for wrong spec")
		} else {
			const verifiedAddress = verifyActionSignature(action)
			assert(verifiedAddress === fromAddress, "action signed by wrong address")
		}
	}

	/**
	 * Create a new session.
	 */
	public async applySession(session: Session): Promise<{ hash: string }> {
		assert(sessionType.is(session), "invalid session")

		const hash = getSessionHash(session)

		const existingRecord = this.messageStore.getSessionByHash(hash)
		if (existingRecord !== null) {
			return { hash }
		}

		await this.queue.add(() => this.applySessionInternal(hash, session))
		await this.publishMessage(hash, { type: "session", ...session })
		return { hash }
	}

	private async applySessionInternal(hash: string, session: Session, options: { sync?: boolean } = {}) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying session ${hash}`), session)
		}

		await this.validateSession(session, options)
		this.messageStore.insertSession(hash, session)
		if (this.mst !== null) {
			const hashBuffer = Buffer.from(hash.slice(2), "hex")
			const leafBuffer = Buffer.alloc(14)
			leafBuffer.writeUintBE(session.payload.timestamp * 2, 0, 6)
			hashBuffer.copy(leafBuffer, 6, 0, 8)
			this.mst.insert(leafBuffer, hashBuffer)
		}

		this.dispatchEvent(new CustomEvent("session", { detail: session.payload }))
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Successfully applied session ${hash}`))
		}
	}

	private async validateSession(session: Session, options: { sync?: boolean }) {
		const { from, spec, timestamp, block } = session.payload
		assert(spec === this.uri, "session signed for wrong spec")

		const verifiedAddress = verifySessionSignature(session)
		assert(verifiedAddress.toLowerCase() === from.toLowerCase(), "session signed by wrong address")

		// check the timestamp bounds
		assert(timestamp > Core.boundsCheckLowerLimit, "session timestamp too far in the past")
		assert(timestamp < Core.boundsCheckUpperLimit, "session timestamp too far in the future")

		// check the session was signed with a valid, recent block
		if (!this.options.unchecked) {
			assert(block !== undefined, "session missing block info")
			await this.verifyBlock(block, options)
		}
	}

	public getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[] {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		return this.modelStore.getRoute(route, params)
	}

	private async publishMessage(hash: string, message: Message) {
		if (this.libp2p === null) {
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Publishing action ${hash} to GossipSub`)
		}

		await this.libp2p.pubsub
			.publish(this.uri, encodeMessage(message))
			.then(({ recipients }) => {
				if (this.options.verbose) {
					console.log(`[canvas-core] Published message to ${recipients.length} peers`)
				}
			})
			.catch((err) => {
				console.error(chalk.red("[canvas-core] Failed to publish action to pubsub topic"), err)
			})
	}

	private handleMessage: EventHandler<CustomEvent<SignedMessage | UnsignedMessage>> = async ({
		detail: { topic, data },
	}) => {
		if (topic !== this.uri) {
			return
		}

		const hash = toHex(createHash("sha256").update(data).digest())

		const message = decodeMessage(data)
		try {
			if (message.type === "action") {
				await this.queue.add(() => this.applyActionInternal(hash, message))
			} else if (message.type === "session") {
				await this.queue.add(() => this.applySessionInternal(hash, message))
			} else {
				signalInvalidType(message)
			}
		} catch (err) {
			console.log(chalk.red("[canvas-core] Error applying peer message"), err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		if (this.rpcServer === null) {
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Handling incoming stream ${stream.id} from peer ${connection.remotePeer.toString()}`)
		}

		await this.rpcServer.handleIncomingStream(stream)
		if (this.options.verbose) {
			console.log(`[canvas-core] Closed incoming stream ${stream.id}`)
		}
	}

	private static peeringDelay = 1000 * 5
	private static peeringInterval = 1000 * 60 * 60 * 1
	private static peeringRetryInterval = 1000 * 5
	private async startPeeringService() {
		const { signal } = this.controller
		try {
			await wait({ signal, delay: Core.peeringDelay })
			while (!signal.aborted) {
				await retry(
					this.announce,
					(err) => console.log(chalk.red(`[canvas-core] Failed to publish DHT rendezvous record`), err),
					{ signal, delay: Core.peeringRetryInterval }
				)
				await wait({ signal, delay: Core.peeringInterval })
			}
		} catch (err) {
			console.log(`[canvas-core] Aborting peering service`)
		}
	}

	private announce = async (signal: AbortSignal): Promise<void> => {
		if (this.libp2p === null) {
			return
		}

		console.log(chalk.green(`[canvas-core] Publishing DHT rendezvous record ${this.cid.toString()}`))
		await this.libp2p.contentRouting.provide(this.cid, { signal })
		console.log(chalk.green(`[canvas-core] Successfully published DHT rendezvous record`))
	}

	private static syncDelay = 1000 * 10
	private static syncInterval = 1000 * 60 * 1
	private static syncRetryInterval = 1000 * 5
	private async startSyncService() {
		const { signal } = this.controller

		try {
			await wait({ signal, delay: Core.syncDelay })
			while (!signal.aborted) {
				const peers = await retry(
					this.findPeers,
					(err) => console.log(chalk.red(`[canvas-core] Failed to locate application peers`), err),
					{ signal, delay: Core.syncRetryInterval }
				)

				console.log(chalk.green(`[canvas-core] Found ${peers.length} application peers`))

				for (const [i, peer] of peers.entries()) {
					console.log(chalk.green(`[canvas-core] Initiating sync with ${peer.toString()} (${i + 1}/${peers.length})`))
					await this.sync(peer)
				}

				await wait({ signal, delay: Core.syncInterval })
			}
		} catch (err) {
			console.log(`[canvas-core] Aborting sync service`)
		}
	}

	private findPeers = async (signal: AbortSignal): Promise<PeerId[]> => {
		const peers: PeerId[] = []
		this.libp2p?.pubsub.getSubscribers(this.uri)

		if (this.libp2p !== null) {
			for await (const { id } of this.libp2p.contentRouting.findProviders(this.cid, { signal })) {
				if (id.equals(this.libp2p.peerId)) {
					continue
				} else {
					peers.push(id)
				}
			}
		}

		return peers
	}

	private async sync(peer: PeerId) {
		if (this.mst === null || this.libp2p === null) {
			return
		}

		const { signal } = this.controller

		let stream: Stream
		try {
			stream = await this.libp2p.dialProtocol(peer, this.syncProtocol, { signal })
		} catch (err) {
			console.log(chalk.red(`[canvas-core] Failed to dial peer ${peer.toString()}`, err))
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Opened outgoing stream ${stream.id} to ${peer.toString()}`)
		}

		const closeStream = () => stream.close()
		signal.addEventListener("abort", closeStream)

		let successCount = 0
		let failureCount = 0
		const applyBatch = (messages: Iterable<[string, RPC.Message]>) =>
			this.queue.add(async () => {
				for (const [hash, message] of messages) {
					if (this.options.verbose) {
						console.log(chalk.green(`[canvas-core] Received missing ${message.type} ${hash}`))
					}

					if (message.type === "session") {
						const { type, ...session } = message
						try {
							await this.applySessionInternal(hash, session, { sync: true })
							successCount += 1
						} catch (err) {
							console.log(chalk.red(`[canvas-core] Failed to apply session ${hash}`), err)
							failureCount += 1
						}
					} else if (message.type === "action") {
						const { type, ...action } = message
						try {
							await this.applyActionInternal(hash, action, { sync: true })
							successCount += 1
						} catch (err) {
							console.log(chalk.red(`[canvas-core] Failed to apply action ${hash}`), err)
							failureCount += 1
						}
					} else {
						signalInvalidType(message)
					}
				}
			})

		await RPC.sync(this.mst, stream, applyBatch)
		console.log(
			`[canvas-core] Sync with ${peer.toString()} completed. Applied ${successCount} new messages with ${failureCount} failures.`
		)

		signal.removeEventListener("abort", closeStream)

		if (this.options.verbose) {
			console.log(`[canvas-core] Closed outgoing stream ${stream.id}`)
		}
	}
}
