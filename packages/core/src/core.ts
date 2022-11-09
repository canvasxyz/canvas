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
	Block,
	Session,
	SessionPayload,
	verifyActionSignature,
	verifySessionSignature,
	ModelValue,
	Message,
} from "@canvas-js/interfaces"

import { actionType, sessionType } from "./codecs.js"
import { signalInvalidType, wait, retry, toHex, BlockResolver } from "./utils.js"
import { encodeMessage, decodeMessage, getActionHash, getSessionHash } from "./encoding.js"
import { VM } from "./vm/index.js"
import { MessageStore } from "./messageStore.js"
import { ModelStore } from "./modelStore.js"

import * as RPC from "./rpc/index.js"
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
	public readonly rpcServer: RPC.Server | null = null

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

		const modelDatabasePath = directory && path.resolve(directory, constants.MODEL_DATABASE_FILENAME)
		this.modelStore = new ModelStore(modelDatabasePath, vm.models, vm.routes, { verbose: options.verbose })

		const messageDatabasePath = directory && path.resolve(directory, constants.MESSAGE_DATABASE_FILENAME)
		this.messageStore = new MessageStore(uri, messageDatabasePath, { verbose: options.verbose })

		if (directory !== null) {
			// offline cores might be run with a non-null directory; we still want to update the MST
			this.mst = new okra.Tree(path.resolve(directory, constants.MST_FILENAME))

			if (libp2p !== null && !this.options.offline) {
				this.rpcServer = new RPC.Server({ mst: this.mst, messageStore: this.messageStore })

				libp2p.pubsub.subscribe(this.uri)
				libp2p.pubsub.addEventListener("message", this.handleMessage)
				if (this.options.verbose) {
					console.log(`[canvas-core] Subscribed to pubsub topic ${this.uri}`)
				}

				libp2p.handle(this.syncProtocol, this.handleIncomingStream)
				this.startSyncService(libp2p)
				this.startPeeringService(libp2p)
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
	public async verifyBlock(blockInfo: Block) {
		const { chain, chainId, blocknum, blockhash, timestamp } = blockInfo
		const block = await this.blockResolver(chain, chainId, blockhash)

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
		const { timestamp, block, spec } = action.payload
		const fromAddress = action.payload.from.toLowerCase()

		assert(spec === this.uri, "action signed for wrong spec")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the action was signed with a valid, recent block
			assert(block !== undefined, "action is missing block data")
			await this.verifyBlock(block)
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
		const { from, spec, timestamp, block } = session.payload
		assert(spec === this.uri, "session signed for wrong spec")

		const verifiedAddress = verifySessionSignature(session)
		assert(verifiedAddress.toLowerCase() === from.toLowerCase(), "session signed by wrong address")

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "session timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "session timestamp too far in the future")

		if (!this.options.unchecked) {
			// check the session was signed with a valid, recent block
			assert(block !== undefined, "session is missing block data")
			await this.verifyBlock(block)
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
	private async startPeeringService(libp2p: Libp2p) {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring announce service")
		}

		const { signal } = this.controller
		try {
			await wait({ signal, delay: Core.peeringDelay })
			while (!signal.aborted) {
				await retry(
					(signal) => this.announce(libp2p, signal),
					(err) => {
						const message = err instanceof Error ? err.message : err.toString()
						console.log(chalk.red(`[canvas-core] Failed to publish DHT rendezvous record.`), message)
					},
					{ signal, delay: Core.peeringRetryInterval }
				)
				await wait({ signal, delay: Core.peeringInterval })
			}
		} catch (err) {
			if (err instanceof Event && err.type === "abort") {
				if (this.options.verbose) {
					console.log(`[canvas-core] Aborting peering service.`)
				}
			} else {
				console.log(chalk.red(`[canvas-core] Peering service crashed.`), err)
			}
		}
	}

	private async announce(libp2p: Libp2p, signal: AbortSignal): Promise<void> {
		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Publishing DHT rendezvous record ${this.cid.toString()}`))
		}

		await libp2p.contentRouting.provide(this.cid, { signal })

		if (this.options.verbose) {
			console.log(chalk.green(`[canvas-core] Successfully published DHT rendezvous record.`))
		}
	}

	private static syncDelay = 1000 * 10
	private static syncInterval = 1000 * 60 * 1
	private static syncRetryInterval = 1000 * 5
	private async startSyncService(libp2p: Libp2p) {
		if (this.options.verbose) {
			console.log("[canvas-core] Staring sync service")
		}

		const { signal } = this.controller

		try {
			await wait({ signal, delay: Core.syncDelay })
			while (!signal.aborted) {
				const peers = await retry(
					(signal) => this.findPeers(libp2p, signal),
					(err) => {
						const message = err instanceof Error ? err.message : err.toString()
						console.log(chalk.red(`[canvas-core] Failed to locate application peers.`), message)
					},
					{ signal, delay: Core.syncRetryInterval }
				)

				if (this.options.verbose) {
					console.log(chalk.green(`[canvas-core] Found ${peers.length} peers for ${this.uri}`))
				}

				for (const [i, peer] of peers.entries()) {
					if (this.options.verbose) {
						console.log(chalk.green(`[canvas-core] Initiating sync with ${peer.toString()} (${i + 1}/${peers.length})`))
					}
					await this.sync(libp2p, peer)
				}

				await wait({ signal, delay: Core.syncInterval })
			}
		} catch (err) {
			if (err instanceof Event && err.type === "abort") {
				if (this.options.verbose) {
					console.log("[canvas-core] Aborting sync service.")
				}
			} else {
				console.log(chalk.red(`[canvas-core] Sync service crashed.`), err)
			}
		}
	}

	async findPeers(libp2p: Libp2p, signal: AbortSignal): Promise<PeerId[]> {
		const peers: PeerId[] = []

		// this.libp2p.pubsub.getSubscribers(this.uri)
		for await (const { id } of libp2p.contentRouting.findProviders(this.cid, { signal })) {
			if (id.equals(libp2p.peerId)) {
				continue
			} else {
				peers.push(id)
			}
		}

		return peers
	}

	private async sync(libp2p: Libp2p, peer: PeerId) {
		if (this.mst === null) {
			return
		}

		const { signal } = this.controller

		let stream: Stream
		try {
			stream = await libp2p.dialProtocol(peer, this.syncProtocol, { signal })
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
