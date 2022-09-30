import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"

import { ethers } from "ethers"
import { QuickJSWASMModule } from "quickjs-emscripten"

import chalk from "chalk"
import PQueue from "p-queue"
import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"

import { createLibp2p, Libp2p } from "libp2p"
import { TCP } from "@libp2p/tcp"
import { Noise } from "@chainsafe/libp2p-noise"
import { Mplex } from "@libp2p/mplex"
import { MulticastDNS } from "@libp2p/mdns"
import { GossipSub } from "@chainsafe/libp2p-gossipsub"
import type { Message as PubSubMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from "@libp2p/peer-id-factory"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"

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
} from "@canvas-js/interfaces"

import { ModelStore, SqliteStore } from "./models/index.js"
import { actionType, sessionType } from "./codecs.js"
import { CacheMap, signalInvalidType, getTopic, getProtocol, wait, retry } from "./utils.js"
import { decodeBinaryMessage, encodeBinaryMessage, getActionHash, getSessionHash } from "./encoding.js"
import { VM, Exports } from "./vm/index.js"
import { MessageStore } from "./messages/index.js"
import { handleSource, handleTarget, Message } from "./sync.js"

export interface CoreConfig {
	name: string
	directory: string | null
	spec: string
	quickJS: QuickJSWASMModule
	store?: ModelStore
	replay?: boolean
	verbose?: boolean
	unchecked?: boolean
	rpc?: Partial<Record<Chain, Record<string, string>>>
	peering?: boolean
	peeringPort?: number
}

interface CoreEvents {
	close: Event
	error: Event
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

export class Core extends EventEmitter<CoreEvents> {
	public static readonly MST_FILENAME = "mst.okra"
	private static readonly cidPattern = /^[a-zA-Z0-9]+$/
	public static async initialize(config: CoreConfig): Promise<Core> {
		const { directory, name, spec, verbose, unchecked, rpc, replay, quickJS, peering, peeringPort: port } = config

		if (verbose) {
			console.log(`[canvas-core] Initializing core ${name}`)
		}

		const cid = await Hash.of(spec).then((cid) => {
			if (Core.cidPattern.test(name)) {
				assert(cid === name, "Core.name is not equal to the hash of the provided spec.")
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

		const { vm, exports } = await VM.initialize(name, spec, providers, quickJS, { verbose })

		const modelStore =
			config.store || new SqliteStore(directory && path.resolve(directory, SqliteStore.DATABASE_FILENAME))

		if (exports.database !== undefined) {
			assert(
				modelStore.identifier === exports.database,
				`spec requires a ${exports.database} model store, but the core was initialized with a ${modelStore.identifier} model store`
			)
		}

		await modelStore.initialize(exports.models, exports.routes)

		const messageStore = new MessageStore(name, directory, { verbose })

		let libp2p: Libp2p | null = null
		if (directory !== null && peering) {
			assert(port !== undefined, "a peeringPort must be provided if peering is enabled")
			const peerIdPath = path.resolve(directory, "id")
			let peerId: PeerId
			if (fs.existsSync(peerIdPath)) {
				peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
			} else {
				peerId = await createEd25519PeerId()
				fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
			}

			console.log(`[canvas-core] PeerId ${peerId.toString()}`)

			libp2p = await createLibp2p({
				peerId,
				addresses: { listen: [`/ip4/0.0.0.0/tcp/${port}`] },
				transports: [new TCP()],
				connectionEncryption: [new Noise()],
				streamMuxers: [new Mplex()],
				peerDiscovery: [new MulticastDNS()],
				pubsub: new GossipSub({
					doPX: true,
					fallbackToFloodsub: false,
					allowPublishToZeroPeers: true,
					globalSignaturePolicy: "StrictSign",
				}),
			})

			await libp2p.start()
		}

		let mst: okra.Tree | null = null
		if (directory !== null) {
			const mstPath = path.resolve(directory, Core.MST_FILENAME)
			mst = new okra.Tree(mstPath)
			if (verbose) {
				console.log(`[canvas-core] Using MST at ${mstPath}`)
			}
		}

		const options = { verbose, unchecked, peering: true, sync: true }
		const core = new Core(name, cid, vm, exports, modelStore, messageStore, providers, libp2p, mst, options)

		if (replay) {
			console.log(`[canvas-core] Replaying action log...`)

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

			console.log(`[canvas-core] Successfully replayed all ${i} entries from the action log.`)
		}

		if (verbose) {
			console.log(`[canvas-core] Successfully initialized core ${config.name}`)
		}

		return core
	}

	private readonly blockCache: Record<string, CacheMap<string, { number: number; timestamp: number }>> = {}
	private readonly blockCacheMostRecentTimestamp: Record<string, number> = {}

	private readonly protocol: string
	private readonly topic: string
	private readonly queue: PQueue

	private constructor(
		public readonly name: string,
		public readonly cid: CID,
		public readonly vm: VM,
		public readonly exports: Exports,
		public readonly modelStore: ModelStore,
		public readonly messageStore: MessageStore,
		public readonly providers: Record<string, ethers.providers.JsonRpcProvider> = {},
		public readonly libp2p: Libp2p | null,
		public readonly mst: okra.Tree | null,
		private readonly options: {
			verbose?: boolean
			unchecked?: boolean
			peering?: boolean
			sync?: boolean
		}
	) {
		super()
		this.protocol = getProtocol(this.cid)
		this.topic = getTopic(this.cid)

		this.queue = new PQueue({ concurrency: 1 })

		// keep up to 128 past blocks
		const CACHE_SIZE = 128

		// set up rpc providers and block caches
		for (const [key, provider] of Object.entries(providers)) {
			this.blockCache[key] = new CacheMap(CACHE_SIZE)

			// listen for new blocks
			provider.on("block", async (blocknum: number) => {
				const { timestamp, hash, number } = await this.providers[key].getBlock(blocknum)
				if (this.options.verbose) {
					console.log(`[canavs-core] Caching ${key} block ${number} (${hash})`)
				}

				this.blockCacheMostRecentTimestamp[key] = timestamp
				this.blockCache[key].add(hash, { number, timestamp })
			})
		}

		if (this.libp2p !== null) {
			if (options.peering) {
				this.libp2p.pubsub.subscribe(this.topic)
				this.libp2p.pubsub.addEventListener("message", this.handleMessage)
				console.log(`[canvas-core] Subscribed to pubsub topic ${this.topic}`)
			}

			if (options.sync) {
				this.libp2p.handle(this.protocol, this.handleIncomingStream)
				this.startSyncService(this.libp2p)
			}

			if (this.options.verbose) {
				this.libp2p.connectionManager.addEventListener("peer:connect", ({ detail: connection }) => {
					console.log(
						`[canvas-core] Connected to peer ${connection.remotePeer.toString()} with connection ID ${connection.id}`
					)
				})

				this.libp2p.connectionManager.addEventListener("peer:disconnect", ({ detail: connection }) => {
					console.log(`[canvas-core] Disconnected from peer ${connection.remotePeer.toString()}`)
				})
			}
		}
	}

	public async onIdle(): Promise<void> {
		await this.queue.onIdle()
	}

	private readonly controller = new AbortController()
	public async close() {
		for (const provider of Object.values(this.providers)) {
			provider.removeAllListeners("block")
		}

		if (this.libp2p !== null) {
			this.libp2p.pubsub.unsubscribe(this.topic)
			this.libp2p.pubsub.removeEventListener("message")
			this.libp2p.connectionManager.removeEventListener("peer:connect")
			this.libp2p.connectionManager.removeEventListener("peer:disconnect")
			await this.libp2p.stop()
		}

		this.controller.abort()

		await this.queue.onIdle()

		// TODO: think about when and how to close the model store.
		// Right now the model store implementation doesn't actually need closing.
		this.vm.dispose()
		this.dispatchEvent(new Event("close"))
	}

	private static boundsCheckLowerLimit = new Date("2020").valueOf()
	private static boundsCheckUpperLimit = new Date("2070").valueOf()

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	public async verifyBlock(blockInfo: Block, options: { sync?: boolean }) {
		const { chain, chainId, blocknum, blockhash, timestamp } = blockInfo
		const key = `${chain}:${chainId}`
		const provider = this.providers[key]
		const cache = this.blockCache[key]

		// TODO: declare the chains and chainIds that each spec will require upfront
		// Find the block via RPC.
		assert(provider !== undefined && cache !== undefined, `action signed with unsupported chain: ${chain} ${chainId}`)

		let block = cache.get(blockhash.toLowerCase())
		if (block === undefined) {
			if (this.options.verbose) {
				console.log(`[canvas-core] Fetching block ${blockInfo.blockhash} for ${key}`)
			}

			try {
				block = await provider.getBlock(blockInfo.blockhash)
			} catch (err) {
				// TODO: catch rpc errors and identify those separately vs invalid blockhash errors
				throw new Error("Failed to fetch block from RPC provider")
			}

			cache.add(blockhash, block)
		}

		// check the block retrieved from RPC matches metadata from the user
		assert(block, "could not find a valid block:" + JSON.stringify(block))
		assert(block.number === blocknum, "action/session provided with invalid block number")
		assert(block.timestamp === timestamp, "action/session provided with invalid timestamp")

		if (!options.sync) {
			// check the block was recent
			const maxDelay = 30 * 60 // limit propagation to 30 minutes
			assert(
				timestamp >= this.blockCacheMostRecentTimestamp[key] - maxDelay,
				`action must be signed with a recent timestamp, within ${maxDelay}s of the last seen block`
			)
		}
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
		await this.publishMessage(hash, action)
		return { hash }
	}

	private async applyActionInternal(hash: string, action: Action, options: { sync?: boolean } = {}) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying action ${hash}`), action)
		}

		await this.validateAction(action, options)

		const effects = await this.vm.execute(hash, action.payload)
		await this.messageStore.insertAction(hash, action)
		await this.modelStore.applyEffects(action.payload, effects)
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

		assert(spec === this.name, "session signed for wrong spec")

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
			const { session } = await this.messageStore.getSessionByAddress(sessionAddress)
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

		return { hash }
	}

	private async applySessionInternal(hash: string, session: Session, options: { sync?: boolean } = {}) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying session ${hash}`), session)
		}

		await this.validateSession(session, options)
		await this.messageStore.insertSession(hash, session)
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
		assert(spec === this.name, "session signed for wrong spec")

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

	public async getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]> {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		return this.modelStore.getRoute(route, params)
	}

	private async publishMessage(actionHash: string, action: Action) {
		if (this.libp2p === null) {
			return
		}

		let message: Uint8Array
		if (action.session !== null) {
			const { hash: sessionHash, session } = await this.messageStore.getSessionByAddress(action.session)
			assert(sessionHash !== null && session !== null)
			message = encodeBinaryMessage({ hash: actionHash, action }, { hash: sessionHash, session })
		} else {
			message = encodeBinaryMessage({ hash: actionHash, action }, { hash: null, session: null })
		}

		await this.libp2p.pubsub
			.publish(this.topic, message)
			.then(({ recipients }) => {
				if (this.options.verbose) {
					console.log(`[canvas-core] Published message to ${recipients.length} peers`)
				}
			})
			.catch((err) => {
				console.error(chalk.red("[canvas-core] Failed to publish action to pubsub topic"), err)
			})
	}

	private handleMessage = async ({ detail: { topic, data } }: CustomEvent<PubSubMessage>) => {
		if (topic !== this.topic) {
			return
		}

		let decodedMessage: ReturnType<typeof decodeBinaryMessage>
		try {
			decodedMessage = decodeBinaryMessage(data)
		} catch (err) {
			console.error(chalk.red("[canvas-core] Failed to parse pubsub message"), err)
			return
		}

		const { action, session } = decodedMessage
		try {
			if (session !== null) {
				await this.applySession(session)
			}

			await this.applyAction(action)
		} catch (err) {
			console.log(chalk.red("[canvas-core] Error applying peer message"), err)
		}
	}

	private handleIncomingStream: StreamHandler = async ({ connection, stream }) => {
		if (this.options.verbose) {
			console.log(`[canvas-core] Handling incoming stream ${stream.id} from peer ${connection.remotePeer.toString()}`)
		}

		if (this.mst !== null) {
			const source = new okra.Source(this.mst)
			try {
				await handleSource(stream, source, this.messageStore)
			} catch (err) {
				console.log(chalk.red(`[canvas-core] Error in incoming stream handler`), err)
			}

			source.close()

			if (this.options.verbose) {
				console.log(`[canvas-core] Closed incoming stream ${stream.id}`)
			}
		}
	}

	private static syncDelay = 1000 * 5
	private static syncInterval = 1000 * 60 * 5
	private static syncRetryInterval = 1000 * 60
	private async startSyncService(libp2p: Libp2p) {
		const { signal } = this.controller

		try {
			await wait({ delay: Core.syncDelay, signal })
			while (!signal.aborted) {
				const peers = await retry(
					this.findPeers,
					(err) => console.log(chalk.red(`[canvas-core] Failed to locate application peers`), err),
					{ signal, delay: Core.syncRetryInterval }
				)

				console.log(chalk.green(`[canvas-core] Found ${peers.length} application peers`))
				await this.sync(libp2p, peers)
				await wait({ delay: Core.syncInterval, signal })
			}
		} catch (err) {
			console.log(`[canvas-core] Aborting sync service`)
		}
	}

	private findPeers = async (signal: AbortSignal): Promise<PeerId[]> => {
		const peers = new Map<string, PeerId>()

		if (this.libp2p !== null) {
			for (const peer of this.libp2p.getPeers()) {
				const protocols = await this.libp2p.peerStore.protoBook.get(peer)
				if (protocols.includes(this.protocol)) {
					peers.set(peer.toString(), peer)
				}
			}
		}

		return Array.from(peers.values())
	}

	private async sync(libp2p: Libp2p, peers: PeerId[]) {
		if (this.mst === null) {
			return
		}

		const { signal } = this.controller

		for (const [i, peer] of peers.entries()) {
			console.log(chalk.green(`[canvas-core] Initiating sync with ${peer.toString()} (${i + 1}/${peers.length})`))

			let stream: Stream
			try {
				stream = await libp2p.dialProtocol(peer, this.protocol, { signal })
			} catch (err) {
				console.log(chalk.red(`[canvas-core] Failed to dial peer ${peer.toString()}`, err))
				continue
			}

			if (this.options.verbose) {
				console.log(`[canvas-core] Opened outgoing stream ${stream.id} to ${peer.toString()}`)
			}

			const closeStream = () => stream.close()

			signal.addEventListener("abort", closeStream)

			const target = new okra.Target(this.mst)

			let successCount = 0
			let failureCount = 0
			const applyBatch = (messages: Iterable<[string, Message]>) =>
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

			try {
				await handleTarget(stream, target, applyBatch)
				console.log(
					chalk.green(
						`[canvas-core] Sync with ${peer.toString()} completed. Applied ${successCount} new messages with ${failureCount} failures.`
					)
				)
			} catch (err) {
				console.log(chalk.red("[canvas-core] Sync failed"), err)
			}

			signal.removeEventListener("abort", closeStream)
			target.close()

			if (this.options.verbose) {
				console.log(`[canvas-core] Closed outgoing stream ${stream.id}`)
			}
		}
	}
}
