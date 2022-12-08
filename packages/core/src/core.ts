import assert from "node:assert"
import path from "node:path"
import { createHash } from "node:crypto"

import chalk from "chalk"
import PQueue from "p-queue"
import { ethers } from "ethers"
import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"

import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"

import { createLibp2p, Libp2p } from "libp2p"
import type { SignedMessage, UnsignedMessage } from "@libp2p/interface-pubsub"
import type { Stream } from "@libp2p/interface-connection"
import type { PeerId } from "@libp2p/interface-peer-id"
import type { StreamHandler } from "@libp2p/interface-registrar"

import * as okra from "node-okra"

import {
	Action,
	ActionPayload,
	Session,
	SessionPayload,
	ModelValue,
	Message,
	Chain,
	ChainId,
} from "@canvas-js/interfaces"
import { verifyActionSignature, verifySessionSignature } from "@canvas-js/verifiers"

import { actionType, sessionType } from "./codecs.js"
import { signalInvalidType, wait, retry, toHex, BlockResolver, AbortError, CacheMap } from "./utils.js"
import { encodeMessage, decodeMessage, getActionHash, getSessionHash } from "./encoding.js"
import { VM } from "./vm/index.js"
import { MessageStore } from "./messageStore.js"
import { ModelStore } from "./modelStore.js"

import { sync, handleIncomingStream } from "./rpc/index.js"
import * as constants from "./constants.js"
import { getLibp2pInit } from "./libp2p.js"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

export interface CoreConfig extends CoreOptions {
	// pass `null` to run in memory
	directory: string | null
	// defaults to ipfs:// hash of spec
	uri?: string
	spec: string
	libp2p?: Libp2p
	providers?: Record<string, ethers.providers.JsonRpcProvider>
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
	public readonly mst: okra.Tree | null = null

	public readonly recentGossipSubPeers: CacheMap<string, { lastSeen: number }>
	public readonly recentBacklogSyncPeers: CacheMap<string, { lastSeen: number }>

	private readonly queue: PQueue = new PQueue({ concurrency: 1 })
	private readonly controller = new AbortController()

	public static async initialize({ directory, uri, spec, libp2p, providers, blockResolver, ...options }: CoreConfig) {
		const cid = await Hash.of(spec).then(CID.parse)
		if (uri === undefined) {
			uri = `ipfs://${cid.toString()}`
		}

		const vm = await VM.initialize(uri, spec, providers || {})

		if (blockResolver === undefined) {
			blockResolver = (chain, chainId, blockhash) => {
				const key = `${chain}:${chainId}`
				assert(providers !== undefined && key in providers, `no provider for ${chain}:${chainId}`)
				return providers[key].getBlock(blockhash)
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
		this.modelStore = new ModelStore(modelDatabasePath, vm.models, vm.routes, { verbose: options.verbose })

		const messageDatabasePath = directory && path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME)
		this.messageStore = new MessageStore(uri, messageDatabasePath, { verbose: options.verbose })

		this.recentGossipSubPeers = new CacheMap(1000)
		this.recentBacklogSyncPeers = new CacheMap(1000)

		if (directory !== null) {
			// offline cores might be run with a non-null directory; we still want to update the MST
			this.mst = new okra.Tree(path.resolve(directory, constants.MST_FILENAME))

			if (libp2p !== null && !this.options.offline) {
				libp2p.pubsub.subscribe(this.uri)
				libp2p.pubsub.addEventListener("message", this.handleMessage)
				if (this.options.verbose) {
					console.log(`[canvas-core] Using PeerId ${libp2p.peerId.toString()}`)
					console.log(`[canvas-core] Subscribed to pubsub topic ${this.uri}`)
				}

				libp2p.handle(this.syncProtocol, this.streamHandler)
				this.startSyncService()
				this.startAnnounceService()
			}
		}
	}

	public get syncProtocol() {
		return `/x/canvas/sync/${this.cid.toString()}`
	}

	public async onIdle(): Promise<void> {
		await this.queue.onIdle()
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null && !this.options.offline) {
			this.libp2p.unhandle(this.syncProtocol)
			this.libp2p.pubsub.unsubscribe(this.uri)
			this.libp2p.pubsub.removeEventListener("message", this.handleMessage)
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

	/**
	 * Helper for verifying the blockhash for an action or session.
	 */
	public async verifyBlock({ chain, chainId, blockhash }: { chain: Chain; chainId: ChainId; blockhash: string }) {
		await this.blockResolver(chain, chainId, blockhash)
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

	private async applyActionInternal(hash: string, action: Action) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying action ${hash}`), action)
		}

		await this.validateAction(action)

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

	private async validateAction(action: Action) {
		const { timestamp, spec, blockhash, chain, chainId } = action.payload
		const fromAddress = action.payload.from.toLowerCase()

		assert(spec === this.uri, "action signed for wrong spec")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the action was signed with a valid, recent block
			assert(blockhash, "action is missing block data")
			await this.verifyBlock({ blockhash, chain, chainId })
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

			const verifiedAddress = await verifyActionSignature(action)
			assert(verifiedAddress === sessionAddress, "invalid action signature (recovered address does not match)")
			assert(verifiedAddress === session.payload.address, "invalid action signature (action, session do not match)")
			assert(action.payload.spec === session.payload.spec, "action signed for wrong spec")
		} else {
			const verifiedAddress = await verifyActionSignature(action)
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

	private async applySessionInternal(hash: string, session: Session) {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Applying session ${hash}`), session)
		}

		await this.validateSession(session)
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

	private async validateSession(session: Session) {
		const { from, spec, timestamp, blockhash, chain, chainId } = session.payload
		assert(spec === this.uri, "session signed for wrong spec")

		const verifiedAddress = await verifySessionSignature(session)
		assert(verifiedAddress.toLowerCase() === from.toLowerCase(), "session signed by wrong address")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "session timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "session timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the session was signed with a valid, recent block
			assert(blockhash, "session is missing block data")
			await this.verifyBlock({ blockhash, chain, chainId })
		}
	}

	public getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[] {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		return this.modelStore.getRoute(route, params)
	}

	private async publishMessage(hash: string, message: Message) {
		if (this.libp2p === null || this.options.offline) {
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
				const message = err instanceof Error ? err.message : err.toString()
				console.error(chalk.red("[canvas-core] Failed to publish action to pubsub topic"), message)
			})
	}

	private handleMessage = async ({ detail: { topic, data } }: CustomEvent<SignedMessage | UnsignedMessage>) => {
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

	private streamHandler: StreamHandler = async ({ connection, stream }) => {
		if (this.mst === null) {
			return
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Handling incoming stream ${stream.id} from peer ${connection.remotePeer.toString()}`)
		}

		await handleIncomingStream(stream, this.messageStore, this.mst)
		if (this.options.verbose) {
			console.log(`[canvas-core] Closed incoming stream ${stream.id}`)
		}
	}

	private async wait(interval: number) {
		await wait({ signal: this.controller.signal, interval })
	}

	private async startAnnounceService() {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring announce service")
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)
		try {
			await this.wait(constants.ANNOUNCE_DELAY)
			while (!queryController.signal.aborted) {
				await retry(
					() => this.announce(),
					(err) => console.log(chalk.red(`[canvas-core] Failed to publish DHT rendezvous record.`), err.message),
					{ signal: queryController.signal, interval: constants.ANNOUNCE_RETRY_INTERVAL }
				)
				await this.wait(constants.ANNOUNCE_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				if (this.options.verbose) {
					console.log(`[canvas-core] Aborting announce service.`)
				}
			} else {
				console.log(chalk.red(`[canvas-core] Announce service crashed.`))
				console.log(err)
			}
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
			queryController.abort()
		}
	}

	private async announce(): Promise<void> {
		if (this.libp2p === null) {
			return
		}

		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Publishing DHT rendezvous record ${this.cid.toString()}`))
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)
		try {
			await this.libp2p.contentRouting.provide(this.cid, { signal: queryController.signal })
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}

		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Successfully published DHT rendezvous record.`))
		}
	}

	private async startSyncService() {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring sync service")
		}

		try {
			await this.wait(constants.SYNC_DELAY)
			while (!this.controller.signal.aborted) {
				// Also save recently seen gossipsub peers.
				// TODO: move this to its own service, maybe when we start pruning
				// gossipsub peers based on accepted/rejected actions in canvas
				try {
					for (const [i, peer] of this.libp2p?.pubsub.getSubscribers(this.uri).entries() ?? []) {
						this.recentGossipSubPeers.set(peer.toString(), { lastSeen: +new Date() })
					}
				} catch (err) {
					console.log(chalk.red(`[canvas-core] Failed to identify gossipsub peers.`))
				}

				const peers = await retry(
					() => this.findSyncPeers(),
					(err) => console.log(chalk.red(`[canvas-core] Failed to locate application peers.`), err.message),
					{ signal: this.controller.signal, interval: constants.SYNC_RETRY_INTERVAL }
				)

				if (this.options.verbose) {
					console.log(chalk.green(`[canvas-core] Found ${peers.length} peers for ${this.uri}`))
				}

				for (const [i, peer] of peers.entries()) {
					if (this.options.verbose) {
						console.log(chalk.green(`[canvas-core] Initiating sync with ${peer.toString()} (${i + 1}/${peers.length})`))
					}
					this.recentBacklogSyncPeers.set(peer.toString(), { lastSeen: +new Date() })

					await this.sync(peer)
				}

				await this.wait(constants.SYNC_INTERVAL)
			}
		} catch (err) {
			if (err instanceof AbortError) {
				if (this.options.verbose) {
					console.log("[canvas-core] Aborting sync service.")
				}
			} else {
				console.log(chalk.red(`[canvas-core] Sync service crashed.`))
				console.log(err)
			}
		}
	}

	async findSyncPeers(): Promise<PeerId[]> {
		if (this.libp2p === null) {
			return []
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		const { contentRouting } = this.libp2p
		try {
			const peers: PeerId[] = []
			for await (const { id } of contentRouting.findProviders(this.cid, { signal: queryController.signal })) {
				if (id.equals(this.libp2p.peerId)) {
					continue
				} else {
					peers.push(id)
				}
			}
			return peers
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}
	}

	private async sync(peer: PeerId) {
		if (this.libp2p === null || this.mst === null) {
			return
		}

		const queryController = new AbortController()
		const abort = () => queryController.abort()
		this.controller.signal.addEventListener("abort", abort)

		let stream: Stream
		try {
			stream = await this.libp2p.dialProtocol(peer, this.syncProtocol, { signal: queryController.signal })
		} catch (err: any) {
			// show all errors, if we receive an AggregateError
			console.log(chalk.red(`[canvas-core] Failed to sync with ${peer.toString()}`, err.errors ?? err))
			return
		} finally {
			this.controller.signal.removeEventListener("abort", abort)
		}

		if (this.options.verbose) {
			console.log(`[canvas-core] Opened outgoing stream ${stream.id} to ${peer.toString()}`)
		}

		const closeStream = () => stream.close()
		this.controller.signal.addEventListener("abort", closeStream)

		let successCount = 0
		let failureCount = 0

		const applyBatch = (messages: [string, Message][]) =>
			this.queue.add(async () => {
				for (const [hash, message] of messages) {
					if (this.options.verbose) {
						console.log(chalk.green(`[canvas-core] Received missing ${message.type} ${hash}`))
					}

					if (message.type === "session") {
						const { type, ...session } = message
						try {
							await this.applySessionInternal(hash, session)
							successCount += 1
						} catch (err) {
							console.log(chalk.red(`[canvas-core] Failed to apply session ${hash}`), err)
							failureCount += 1
						}
					} else if (message.type === "action") {
						const { type, ...action } = message
						try {
							await this.applyActionInternal(hash, action)
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
			await sync(this.mst, stream, applyBatch)
		} catch (err) {
			console.log(chalk.red(`[canvas-core] ${err}`))
		} finally {
			this.controller.signal.removeEventListener("abort", closeStream)
		}

		console.log(
			`[canvas-core] Sync with ${peer.toString()} completed. Applied ${successCount} new messages with ${failureCount} failures.`
		)

		if (this.options.verbose) {
			console.log(`[canvas-core] Closed outgoing stream ${stream.id}`)
		}
	}
}
