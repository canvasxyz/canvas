// import path from "node:path"

// import chalk from "chalk"
// import { CBORValue } from "microcbor"
// import { sha256 } from "@noble/hashes/sha256"
// import { bytesToHex } from "@noble/hashes/utils"
// import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
// import { createLibp2p, Libp2p } from "libp2p"

// import { validate } from "@hyperjump/json-schema/draft-2020-12"

// import { ModelDB } from "@canvas-js/modeldb-sqlite"
// import { Store } from "@canvas-js/store"
// import { ChainImplementation, CoreAPI, CoreEvents, ApplicationData } from "@canvas-js/interfaces"

// import { VM } from "@canvas-js/core/components/vm"
// import { getPeerId, getLibp2pOptions, P2PConfig, ServiceMap } from "@canvas-js/core/components/libp2p"
// import { signalInvalidType, stringify, assert } from "@canvas-js/core/utils"
// import { BOUNDS_CHECK_LOWER_LIMIT, BOUNDS_CHECK_UPPER_LIMIT, MODEL_DATABASE_FILENAME } from "@canvas-js/core/constants"

// import { Source } from "./source.js"

// export interface CoreConfig extends CoreOptions, P2PConfig {
// 	// pass `null` to run in memory (NodeJS only)
// 	directory: string | null
// 	contract: string

// 	uri?: string
// 	chains?: ChainImplementation<unknown, unknown>[]
// }

// export interface CoreOptions {
// 	unchecked?: boolean
// 	verbose?: boolean
// 	offline?: boolean
// 	replay?: boolean
// 	noExpiration?: boolean
// }

// export class Core extends EventEmitter<CoreEvents> implements CoreAPI {
// 	public static async initialize(config: CoreConfig) {
// 		const { directory, contract, offline, verbose, unchecked, noExpiration } = config

// 		const peerId = await getPeerId(directory)
// 		console.log("[canvas-core]", chalk.bold(`Using PeerId ${peerId}`))

// 		// get p2p config
// 		const { listen, announce, bootstrapList, minConnections, maxConnections } = config
// 		const libp2pOptions = await getLibp2pOptions(peerId, {
// 			listen,
// 			announce,
// 			bootstrapList,
// 			minConnections,
// 			maxConnections,
// 		})

// 		const libp2p = await createLibp2p({ ...libp2pOptions, start: false })

// 		// const chains = config.chains ?? [new EthereumChainImplementation()]
// 		const uri = config.uri ?? `canvas:${bytesToHex(sha256(contract))}`
// 		const vm = await VM.initialize({ uri, contract, unchecked, verbose, noExpiration })

// 		const databasePath = directory === null ? ":memory:" : path.resolve(directory, MODEL_DATABASE_FILENAME)
// 		const db = new ModelDB(databasePath, vm.getModels(), { resolve: (a, b) => a })
// 		// const store = await openStore(libp2p, {})
// 		// const messageStore = await openMessageStore(uri, directory, { verbose })

// 		const options = { verbose, unchecked, noExpiration }
// 		const core = new Core(directory, uri, vm, db, libp2p, options)

// 		// if (config.replay) {
// 		// 	console.log(`[canvas-core] Replaying action log...`)
// 		// 	let i = 0
// 		// 	for await (const [id, message] of messageStore.getMessageStream()) {
// 		// 		if (message.type === "action") {
// 		// 			assert(actionType.is(message), "Invalid action object in message store")
// 		// 			const effects = await vm.execute(id, message.payload)
// 		// 			await modelStore.applyEffects(message.payload, effects)
// 		// 			i++
// 		// 		}
// 		// 	}

// 		// 	console.log("[canvas-core]", chalk.green(`Successfully replayed all ${i} actions from the message store.`))
// 		// }

// 		if (!offline) {
// 			await libp2p.start()
// 			// libp2p.services.pubsub.subscribe(PUBSUB_DISCOVERY_TOPIC)
// 			// await Promise.all(Object.values(core.sources).map((source) => source.start()))
// 		}

// 		return core
// 	}

// 	private readonly topics = new Map<string, Store<CBORValue>>()

// 	private readonly controller = new AbortController()

// 	private constructor(
// 		public readonly directory: string | null,
// 		public readonly uri: string,
// 		public readonly vm: VM,
// 		public readonly db: ModelDB,
// 		public readonly libp2p: Libp2p<ServiceMap>,
// 		public readonly options: CoreOptions
// 	) {
// 		super()

// 		if (libp2p !== null) {
// 			libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
// 				if (options.verbose) {
// 					console.log(chalk.gray(`[canvas-core] Opened connection to ${peerId}`))
// 				}

// 				this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
// 			})

// 			libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
// 				if (options.verbose) {
// 					console.log(chalk.gray(`[canvas-core] Closed connection to ${peerId}`))
// 				}

// 				this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
// 			})

// 			for (const uri of [this.uri, ...vm.sources]) {
// 				const source = new Source({
// 					cid: parseIPFSURI(uri),
// 					applyMessage: this.applyMessageInternal,
// 					messageStore: this.messageStore,
// 					libp2p,
// 					signal: this.controller.signal,
// 					...options,
// 				})

// 				// forward "sync" events from each source store
// 				source.addEventListener("sync", ({ detail }) =>
// 					this.dispatchEvent(new CustomEvent("sync", { detail: { uri, ...detail } }))
// 				)

// 				this.sources[uri] = source
// 			}
// 		}
// 	}

// 	public async getApplicationData(): Promise<ApplicationData> {
// 		const peerId = this.libp2p?.peerId.toString() ?? null

// 		const peers: ApplicationData["peers"] = []
// 		if (this.libp2p !== null) {
// 			for (const id of this.libp2p.getPeers()) {
// 				const peer = await this.libp2p.peerStore.get(id)
// 				const addresses = peer.addresses.map(({ multiaddr }) => multiaddr.toString())
// 				peers.push({ id: id.toString(), addresses })
// 			}
// 		}

// 		return {
// 			peerId,
// 			uri: this.uri,
// 			actions: this.vm.getActions(),
// 			routes: this.vm.getRoutes(),
// 			signers: this.vm.getSigners(),
// 			models: this.vm.getModels(),
// 			peers,
// 			merkleRoots: this.messageStore.getMerkleRoots(),
// 		}
// 	}

// 	public async close() {
// 		this.controller.abort()

// 		if (this.libp2p !== null) {
// 			// for (const connection of this.libp2p.getConnections()) {
// 			// 	await connection.close()
// 			// }

// 			await this.libp2p.stop()
// 		}

// 		await this.vm.close()
// 		await this.db.close()
// 		// await this.messageStore.close()

// 		this.dispatchEvent(new Event("close"))
// 	}

// 	/**
// 	 * Apply a message. This is the "local" entrypoint called by the HTTP API.
// 	 * It inserts the message into the message store, updates the MST index,
// 	 * and publishes to GossipSub.
// 	 */
// 	public async apply(message: Message, noDuplicates?: boolean): Promise<{ hash: string }> {
// 		assert(messageType.is(message), "invalid message")

// 		const app = message.type === "customAction" ? message.app : message.payload.app
// 		assert(app === this.uri || this.vm.sources.has(app))

// 		const data = new TextEncoder().encode(stringify(message))
// 		const hash = sha256(data)
// 		await this.messageStore.write(
// 			async (txn) => {
// 				const existingRecord = await txn.getMessage(hash)
// 				if (existingRecord === null) {
// 					await this.applyMessageInternal(txn, hash, message)
// 					await txn.insertMessage(hash, message)
// 				}
// 			},
// 			{ uri: app }
// 		)

// 		if (this.sources !== null) {
// 			await this.sources[this.uri].publishMessage(hash, data)
// 		}

// 		return { hash: toHex(hash) }
// 	}

// 	/**
// 	 * Apply a message.
// 	 * For actions: validate, execute, apply effects.
// 	 * For sessions: validate.
// 	 * This method is called directly from Core.apply and is
// 	 * also passed to Source as the callback for GossipSub and MST sync messages.
// 	 * Note the this does NOT insert into the message store or publish to GossipSub -
// 	 * that's the responsibility of the caller.
// 	 */
// 	private applyMessageInternal = async (txn: ReadWriteTransaction, hash: Uint8Array, message: Message) => {
// 		const id = toHex(hash)

// 		if (this.options.verbose) {
// 			console.log(`[canvas-core] Applying ${message.type} ${id}`, message)
// 		}

// 		if (message.type === "action") {
// 			await this.validateAction(txn, message)

// 			const effects = await this.vm.execute(hash, message.payload)

// 			this.db.applyEffects(message.payload, effects)
// 		} else if (message.type === "session") {
// 			await this.validateSession(txn, message)
// 		} else if (message.type == "customAction") {
// 			await this.validateCustomAction(txn, message)

// 			const effects = await this.vm.executeCustomAction(hash, message.payload, { timestamp: 0 })

// 			for (const effect of effects) {
// 				if (!effect.id.startsWith(id)) {
// 					throw Error(
// 						`Applying custom action failed: custom actions can only set entries with an id that begins with the action hash`
// 					)
// 				}
// 				if (effect.type == "del") {
// 					throw Error(`Applying custom action failed: the 'del' method cannot be called from within custom actions`)
// 				}
// 			}

// 			// TODO: can we give the user a way to set the timestamp if it comes from a trusted source?
// 			this.db.applyEffects({ timestamp: 0 }, effects)
// 		} else {
// 			signalInvalidType(message)
// 		}

// 		this.dispatchEvent(new CustomEvent("message", { detail: { uri: txn.uri, hash: id, message } }))
// 	}

// 	private async validateAction(txn: ReadWriteTransaction, action: Action) {
// 		const { timestamp, app, block, chain } = action.payload
// 		const fromAddress = action.payload.from

// 		assert(app === this.uri || this.vm.sources.has(app), `action signed for wrong application (${app})`)
// 		assert(this.vm.hasSigner(chain), `unsupported action signer (${chain})`)

// 		// TODO: verify that actions signed for a previous app were valid within that app

// 		// check the timestamp bounds
// 		assert(timestamp > BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
// 		assert(timestamp < BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

// 		// verify the signature, either using a session signature or action signature
// 		if (action.session !== null) {
// 			const [_, session] = await txn.getSessionByAddress(chain, action.session)
// 			assert(session !== null, "session not found")
// 			assert(
// 				action.payload.app === session.payload.app,
// 				"invalid session (action.payload.app and session.payload.app do not match)"
// 			)

// 			assert(session.payload.chain === action.payload.chain, "session and action chains must match")
// 			if (!this.options.noExpiration) {
// 				assert(session.payload.sessionIssued + session.payload.sessionDuration > timestamp, "session expired")
// 			}

// 			assert(session.payload.sessionIssued <= timestamp, "session issued timestamp must precede action timestamp")
// 			assert(session.payload.app === app, "action referenced a session for the wrong application")
// 			assert(
// 				session.payload.from === fromAddress,
// 				"invalid session (action.payload.from and session.payload.from do not match)"
// 			)
// 		}

// 		await this.getChainImplementation(chain).verifyAction(action)
// 	}

// 	private async validateSession(txn: ReadWriteTransaction, session: Session) {
// 		const { app, sessionIssued, block, chain } = session.payload

// 		assert(app === this.uri || this.vm.sources.has(app), `session signed for wrong application (${app})`)
// 		assert(this.vm.hasSigner(chain), `unsupported session signer (${chain})`)

// 		// check the timestamp bounds
// 		assert(sessionIssued > BOUNDS_CHECK_LOWER_LIMIT, "session issued too far in the past")
// 		assert(sessionIssued < BOUNDS_CHECK_UPPER_LIMIT, "session issued too far in the future")

// 		await this.getChainImplementation(chain).verifySession(session)
// 	}

// 	private async validateCustomAction(txn: ReadWriteTransaction, customAction: CustomAction) {
// 		assert(this.vm.customActionSchemaName !== null, `custom action called but no custom action definition exists`)
// 		const schemaName = getCustomActionSchemaName(this.uri, customAction.name)
// 		assert(
// 			this.vm.customActionSchemaName === schemaName,
// 			`the custom action name in the message does not match the action name in the contract`
// 		)

// 		const { valid, errors } = await validate(schemaName, customAction.payload)
// 		assert(valid, `custom action payload does not match the provided schema! ${errors}`)
// 	}

// 	private getChainImplementation(chain: string): ChainImplementation<unknown, unknown> {
// 		const implementation = this.chains.find((implementation) => implementation.chain === chain)
// 		if (implementation === undefined) {
// 			throw new Error(`Could not find matching chain implementation for ${chain}`)
// 		} else {
// 			return implementation
// 		}
// 	}
// }
