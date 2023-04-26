import chalk from "chalk"
import Hash from "ipfs-only-hash"
import { sha256 } from "@noble/hashes/sha256"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"

import { PeerId } from "@libp2p/interface-peer-id"
import { Multiaddr, multiaddr } from "@multiformats/multiaddr"
import { CID } from "multiformats/cid"
import { validate } from "@hyperjump/json-schema/draft-2020-12"

import {
	Action,
	Session,
	ModelValue,
	Message,
	ChainImplementation,
	CustomAction,
	CoreAPI,
	CoreEvents,
	ApplicationData,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { VM } from "@canvas-js/core/components/vm"
import { ModelStore, openModelStore } from "@canvas-js/core/components/modelStore"
import { MessageStore, openMessageStore, ReadOnlyTransaction } from "@canvas-js/core/components/messageStore"
import { getPeerId, getLibp2pOptions, P2PConfig } from "@canvas-js/core/components/libp2p"
import { DiscoveryRecord, actionType, discoveryRecord, messageType } from "@canvas-js/core/codecs"
import {
	toHex,
	signalInvalidType,
	stringify,
	parseIPFSURI,
	assert,
	getCustomActionSchemaName,
	wait,
	logErrorMessage,
	retry,
} from "@canvas-js/core/utils"
import {
	PUBSUB_ANNOUNCE_DELAY,
	PUBSUB_ANNOUNCE_INTERVAL,
	BOUNDS_CHECK_LOWER_LIMIT,
	BOUNDS_CHECK_UPPER_LIMIT,
	PUBSUB_DISCOVERY_TOPIC,
	PUBSUB_ANNOUNCE_RETRY_INTERVAL,
} from "@canvas-js/core/constants"

import { Source } from "./source.js"

export interface CoreConfig extends CoreOptions, P2PConfig {
	// pass `null` to run in memory (NodeJS only)
	directory: string | null
	spec: string

	uri?: string
	chains?: ChainImplementation<unknown, unknown>[]
}

export interface CoreOptions {
	unchecked?: boolean
	verbose?: boolean
	offline?: boolean
	replay?: boolean
}

export class Core extends EventEmitter<CoreEvents> implements CoreAPI {
	public static async initialize(config: CoreConfig) {
		const { directory, spec, offline, verbose, unchecked } = config

		const chains = config.chains ?? [new EthereumChainImplementation()]
		const cid = await Hash.of(spec).then(CID.parse)
		const app = config.uri ?? `ipfs://${cid}`
		const vm = await VM.initialize({ app, spec, chains, unchecked, verbose })

		const modelStore = await openModelStore(directory, vm, { verbose })
		const messageStore = await openMessageStore(app, directory, vm.sources, { verbose })

		let libp2p: Libp2p | null = null
		if (!offline) {
			const peerId = await getPeerId(directory)
			console.log("[canvas-core]", chalk.bold(`Using PeerId ${peerId}`))

			// get p2p config
			const { listen, announce, bootstrapList, minConnections, maxConnections } = config
			const options = await getLibp2pOptions(peerId, {
				listen,
				announce,
				bootstrapList,
				minConnections,
				maxConnections,
			})

			libp2p = await createLibp2p({ ...options, start: false })
		}

		const options = { verbose, unchecked }
		const core = new Core(directory, cid, app, vm, modelStore, messageStore, libp2p, chains, options)

		if (config.replay) {
			console.log(`[canvas-core] Replaying action log...`)
			let i = 0
			for await (const [id, message] of messageStore.getMessageStream()) {
				if (message.type === "action") {
					assert(actionType.is(message), "Invalid action object in message store")
					const effects = await vm.execute(id, message.payload)
					await modelStore.applyEffects(message.payload, effects)
					i++
				}
			}

			console.log("[canvas-core]", chalk.green(`Successfully replayed all ${i} actions from the message store.`))
		}

		if (libp2p !== null && core.sources !== null) {
			await libp2p.start()

			libp2p.pubsub.subscribe(PUBSUB_DISCOVERY_TOPIC)

			await Promise.all(Object.values(core.sources).map((source) => source.start()))
		}

		return core
	}

	public readonly sources: Record<string, Source> | null = null

	private readonly controller = new AbortController()

	private constructor(
		public readonly directory: string | null,
		public readonly cid: CID,
		public readonly app: string,
		public readonly vm: VM,
		public readonly modelStore: ModelStore,
		public readonly messageStore: MessageStore,
		public readonly libp2p: Libp2p | null,
		public readonly chains: ChainImplementation<unknown, unknown>[],
		public readonly options: CoreOptions
	) {
		super()

		// forward "update" events from the message store
		messageStore.addEventListener("update", ({ detail }) => {
			this.dispatchEvent(new CustomEvent("update", { detail }))
		})

		if (libp2p !== null) {
			libp2p.addEventListener("peer:connect", ({ detail: { id, remotePeer, remoteAddr } }) => {
				if (options.verbose) {
					console.log(chalk.gray(`[canvas-core] Opened connection ${id} to ${remotePeer} at ${remoteAddr}`))
				}

				this.dispatchEvent(new CustomEvent("connect", { detail: { peer: remotePeer.toString() } }))
			})

			libp2p.addEventListener("peer:disconnect", ({ detail: { id, remotePeer } }) => {
				if (options.verbose) {
					console.log(chalk.gray(`[canvas-core] Closed connection ${id} to ${remotePeer}`))
				}

				this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: remotePeer.toString() } }))
			})

			this.sources = {}
			for (const uri of [this.app, ...vm.sources]) {
				const source = new Source({
					cid: parseIPFSURI(uri),
					applyMessage: this.applyMessageInternal,
					messageStore: this.messageStore,
					libp2p,
					signal: this.controller.signal,
					...options,
				})

				// forward "sync" events from each source store
				source.addEventListener("sync", ({ detail }) =>
					this.dispatchEvent(new CustomEvent("sync", { detail: { uri, ...detail } }))
				)

				this.sources[uri] = source
			}

			libp2p.pubsub.addEventListener("message", ({ detail: msg }) => {
				if (msg.type !== "signed") {
					return
				}

				if (msg.topic === PUBSUB_DISCOVERY_TOPIC) {
					const decoder = new TextDecoder()
					let record: DiscoveryRecord
					try {
						const data = JSON.parse(decoder.decode(msg.data))
						assert(discoveryRecord.is(data))
						record = data
					} catch (err) {
						console.log(chalk.yellow("[canvas-core] Received invalid discovery record"), msg)
						return
					}

					this.handleDiscovery(msg.from, record)
				}
			})

			this.startAnnounceService()
		}
	}

	public async getApplicationData(): Promise<ApplicationData> {
		const peerId = this.libp2p?.peerId.toString() ?? null

		const peers: ApplicationData["peers"] = []
		if (this.libp2p !== null) {
			for (const id of this.libp2p.getPeers()) {
				const peer = await this.libp2p.peerStore.get(id)
				const addresses = peer.addresses.map(({ multiaddr }) => multiaddr.toString())
				peers.push({ id: id.toString(), addresses })
			}
		}

		return {
			peerId,
			uri: this.app,
			cid: this.cid.toString(),
			actions: this.vm.getActions(),
			routes: this.vm.getRoutes(),
			chains: this.vm.getChains(),
			models: this.vm.getModels(),
			peers,
			merkleRoots: this.messageStore.getMerkleRoots(),
		}
	}

	public async close() {
		this.controller.abort()

		if (this.libp2p !== null) {
			// for (const connection of this.libp2p.getConnections()) {
			// 	await connection.close()
			// }

			await this.libp2p.stop()
		}

		await this.vm.close()
		await this.modelStore.close()
		await this.messageStore.close()

		this.dispatchEvent(new Event("close"))
	}

	public async getRoute<T extends Record<string, ModelValue> = Record<string, ModelValue>>(
		route: string,
		params: Record<string, string>
	): Promise<T[]> {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		const results = await this.modelStore.getRoute(route, params)
		return results as T[]
	}

	/**
	 * Apply a message. This is the "local" entrypoint called by the HTTP API.
	 * It inserts the message into the message store, updates the MST index,
	 * and publishes to GossipSub.
	 */
	public async apply(message: Message): Promise<{ hash: string }> {
		assert(messageType.is(message), "invalid message")

		const app = message.type === "customAction" ? message.app : message.payload.app
		assert(app === this.app || this.vm.sources.has(app))

		const data = new TextEncoder().encode(stringify(message))
		const hash = sha256(data)
		await this.messageStore.write(
			async (txn) => {
				const existingRecord = await txn.getMessage(hash)
				if (existingRecord !== null) {
					return
				}

				await this.applyMessageInternal(txn, hash, message)
				await txn.insertMessage(hash, message)
			},
			{ uri: app }
		)

		if (this.sources !== null) {
			await this.sources[this.app].publishMessage(hash, data)
		}

		return { hash: toHex(hash) }
	}

	/**
	 * Apply a message.
	 * For actions: validate, execute, apply effects.
	 * For sessions: validate.
	 * This method is called directly from Core.apply and is
	 * also passed to Source as the callback for GossipSub and MST sync messages.
	 * Note the this does NOT insert into the message store or publish to GossipSub -
	 * that's the responsibility of the caller.
	 */
	private applyMessageInternal = async (txn: ReadOnlyTransaction, hash: Uint8Array, message: Message) => {
		const id = toHex(hash)

		if (this.options.verbose) {
			console.log(`[canvas-core] Applying ${message.type} ${id}`, message)
		}

		if (message.type === "action") {
			await this.validateAction(txn, message)

			const effects = await this.vm.execute(hash, message.payload)

			this.modelStore.applyEffects(message.payload, effects)
		} else if (message.type === "session") {
			await this.validateSession(txn, message)
		} else if (message.type == "customAction") {
			await this.validateCustomAction(txn, message)

			const effects = await this.vm.executeCustomAction(hash, message.payload, { timestamp: 0 })

			for (const effect of effects) {
				if (!effect.id.startsWith(id)) {
					throw Error(
						`Applying custom action failed: custom actions can only set entries with an id that begins with the action hash`
					)
				}
				if (effect.type == "del") {
					throw Error(`Applying custom action failed: the 'del' method cannot be called from within custom actions`)
				}
			}

			// TODO: can we give the user a way to set the timestamp if it comes from a trusted source?
			this.modelStore.applyEffects({ timestamp: 0 }, effects)
		} else {
			signalInvalidType(message)
		}

		this.dispatchEvent(new CustomEvent("message", { detail: { uri: txn.uri, hash: id, message } }))
	}

	private async validateAction(txn: ReadOnlyTransaction, action: Action) {
		const { timestamp, app, block, chain } = action.payload
		const fromAddress = action.payload.from

		assert(app === this.app || this.vm.sources.has(app), `action signed for wrong application (${app})`)
		assert(this.vm.getChains().includes(chain), `unsupported chain (${chain})`)

		// TODO: verify that actions signed for a previous app were valid within that app

		// check the timestamp bounds
		assert(timestamp > BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const [_, session] = await txn.getSessionByAddress(chain, action.session)
			assert(session !== null, "session not found")
			assert(
				action.payload.app === session.payload.app,
				"invalid session (action.payload.app and session.payload.app do not match)"
			)
			assert(session.payload.chain === action.payload.chain, "session and action chains must match")
			assert(session.payload.sessionIssued + session.payload.sessionDuration > timestamp, "session expired")
			assert(session.payload.sessionIssued <= timestamp, "session issued timestamp must precede action timestamp")
			assert(session.payload.app === app, "action referenced a session for the wrong application")
			assert(
				session.payload.from === fromAddress,
				"invalid session (action.payload.from and session.payload.from do not match)"
			)
		}

		await this.getChainImplementation(chain).verifyAction(action)
	}

	private async validateSession(txn: ReadOnlyTransaction, session: Session) {
		const { app, sessionIssued, block, chain } = session.payload

		assert(app === this.app || this.vm.sources.has(app), `session signed for wrong application (${app})`)
		assert(this.vm.getChains().includes(chain), `unsupported chain (${chain})`)

		// check the timestamp bounds
		assert(sessionIssued > BOUNDS_CHECK_LOWER_LIMIT, "session issued too far in the past")
		assert(sessionIssued < BOUNDS_CHECK_UPPER_LIMIT, "session issued too far in the future")

		await this.getChainImplementation(chain).verifySession(session)
	}

	private async validateCustomAction(txn: ReadOnlyTransaction, customAction: CustomAction) {
		assert(this.vm.customActionSchemaName !== null, `custom action called but no custom action definition exists`)
		const schemaName = getCustomActionSchemaName(this.app, customAction.name)
		assert(
			this.vm.customActionSchemaName === schemaName,
			`the custom action name in the message does not match the action name in the contract`
		)

		const { valid, errors } = await validate(schemaName, customAction.payload)
		assert(valid, `custom action payload does not match the provided schema! ${errors}`)
	}

	private getChainImplementation(chain: string): ChainImplementation<unknown, unknown> {
		const implementation = this.chains.find((implementation) => implementation.chain === chain)
		if (implementation === undefined) {
			throw new Error(`Could not find matching chain implementation for ${chain}`)
		} else {
			return implementation
		}
	}

	private async handleDiscovery(from: PeerId, record: DiscoveryRecord) {
		if (this.sources === null || this.libp2p === null) {
			return
		}

		if (this.options.verbose) {
			console.log(
				chalk.gray(`[canvas-core] Received discovery record from ${from} with ${record.topics.length} topics`)
			)
		}

		const addrs: Multiaddr[] = []
		for (const address of record.addresses) {
			const addr = multiaddr(address)
			if (addr.getPeerId() === from.toString()) {
				addrs.push(addr)
			}
		}

		for (const uri of record.topics) {
			const source = this.sources[uri]
			if (source !== undefined) {
				source.handlePeerDiscovery(from, addrs)
			}
		}
	}

	private async startAnnounceService() {
		if (this.libp2p === null) {
			return
		}

		const prefix = chalk.magentaBright(`[canvas-core] [pubsub:announce]`)
		if (this.options.verbose) {
			console.log(prefix, "Started GossipSub announce service")
		}

		const { signal } = this.controller
		const libp2p = this.libp2p

		try {
			await wait(PUBSUB_ANNOUNCE_DELAY, { signal })
			while (!signal.aborted) {
				await retry(
					async () => {
						const addrs = libp2p.getMultiaddrs()
						if (addrs.length === 0) {
							throw new Error("no multiaddrs to announce")
						}

						const record: DiscoveryRecord = {
							addresses: addrs.map((addr) => addr.toString()),
							topics: [this.app, ...this.vm.sources],
						}

						const data = new TextEncoder().encode(JSON.stringify(record))

						const { recipients } = await libp2p.pubsub.publish(PUBSUB_DISCOVERY_TOPIC, data)
						if (recipients.length === 0) {
							throw new Error("no GossipSub peers")
						}

						console.log(prefix, `Published discovery record to ${recipients.length} peers`)
					},
					(err) => logErrorMessage(prefix, "Failed to publish discovery record", err),
					{ signal, maxRetries: 3, interval: PUBSUB_ANNOUNCE_RETRY_INTERVAL }
				)

				await wait(PUBSUB_ANNOUNCE_INTERVAL, { signal })
			}
		} catch (err) {
			if (signal.aborted) {
				chalk.gray(prefix, `Service aborted`)
			} else {
				logErrorMessage(prefix, chalk.red(`Service crashed`), err)
			}
		}
	}
}
