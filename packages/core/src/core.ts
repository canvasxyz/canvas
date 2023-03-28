import Hash from "ipfs-only-hash"
import { sha256 } from "@noble/hashes/sha256"
import { CID } from "multiformats/cid"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import chalk from "chalk"

import {
	Action,
	Session,
	ModelValue,
	Chain,
	ChainId,
	Message,
	ChainImplementation,
	CustomAction,
	CoreAPI,
	CoreEvents,
	ApplicationData,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { validate } from "@hyperjump/json-schema/draft-2020-12"

import { VM } from "@canvas-js/core/components/vm"
import { ModelStore, openModelStore } from "@canvas-js/core/components/modelStore"
import { MessageStore, openMessageStore, ReadOnlyTransaction } from "@canvas-js/core/components/messageStore"
import { getPeerId, getLibp2pOptions, startPingService } from "@canvas-js/core/components/libp2p"

import { Source } from "./source.js"
import { actionType, messageType } from "./codecs.js"
import { toHex, signalInvalidType, stringify, parseIPFSURI, assert } from "./utils.js"
import * as constants from "./constants.js"

export interface CoreConfig extends CoreOptions {
	/** pass `null` to run in memory (NodeJS only) */
	directory: string | null
	spec: string

	uri?: string
	chains?: ChainImplementation<unknown, unknown>[]
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	libp2p?: Libp2p
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

		let libp2p = config.libp2p ?? null
		if (!offline && libp2p === null) {
			const { listen, announce, bootstrapList } = config
			const peerId = await getPeerId(directory)
			const options = await getLibp2pOptions({ peerId, listen, announce, bootstrapList })

			libp2p = await createLibp2p(options)
		}

		const core = new Core(directory, cid, app, vm, modelStore, messageStore, libp2p, chains, { verbose, unchecked })

		if (config.replay) {
			console.log(chalk.green(`[canvas-core] Replaying action log...`))
			let i = 0
			for await (const [id, message] of messageStore.getMessageStream()) {
				if (message.type === "action") {
					assert(actionType.is(message), "Invalid action object in message store")
					const effects = await vm.execute(id, message.payload)
					await modelStore.applyEffects(message.payload, effects)
					i++
				}
			}

			console.log(chalk.green(`[canvas-core] Successfully replayed all ${i} actions from the message store.`))
		}

		if (libp2p !== null && core.sources !== null) {
			await Promise.all(Object.values(core.sources).map((source) => source.start()))
			startPingService(libp2p, core.controller)
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
		messageStore.addEventListener("update", (event) => {
			this.dispatchEvent(new Event(event.type))
		})

		if (libp2p !== null) {
			libp2p.addEventListener("peer:connect", ({ detail: connection }) => {
				this.dispatchEvent(new CustomEvent("connect", { detail: { peer: connection.remotePeer.toString() } }))

				if (options.verbose) {
					console.log(`[canvas-core] Connected to ${connection.remotePeer} (${connection.id})`)
				}
			})

			libp2p.addEventListener("peer:disconnect", ({ detail: connection }) => {
				this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: connection.remotePeer.toString() } }))

				if (options.verbose) {
					console.log(`[canvas-core] Disconnected from ${connection.remotePeer} (${connection.id})`)
				}
			})

			this.sources = {}
			for (const uri of [this.app, ...vm.sources]) {
				const source = new Source({
					cid: parseIPFSURI(uri),
					applyMessage: this.applyMessageInternal,
					messageStore: this.messageStore,
					libp2p,
					...options,
				})

				// forward "sync" events from each source store
				source.addEventListener("sync", ({ detail }) =>
					this.dispatchEvent(new CustomEvent("sync", { detail: { uri, ...detail } }))
				)

				this.sources[uri] = source
			}
		}
	}

	public async getApplicationData(): Promise<ApplicationData> {
		const chains: ApplicationData["chains"] = {}
		for (const { chain, chainId } of this.chains) {
			const chainIds = chains[chain]
			if (chainIds === undefined) {
				chains[chain] = [chainId]
			} else if (!chainIds.includes(chainId)) {
				chainIds.push(chainId)
			}
		}

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
			appName: this.vm.appName,
			actions: this.vm.actions,
			routes: Object.keys(this.vm.routes),
			chains,
			peers,
			merkleRoots: this.messageStore.getMerkleRoots(),
		}
	}

	public async close() {
		this.controller.abort()

		if (this.sources !== null) {
			await Promise.all(Object.values(this.sources).map((source) => source.stop()))
		}

		if (this.libp2p !== null) {
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
		assert(messageType.is(message), "invalid session object")

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
			{ dbi: app }
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

		this.dispatchEvent(new CustomEvent("message", { detail: message }))
	}

	private async validateAction(txn: ReadOnlyTransaction, action: Action) {
		const { timestamp, app, appName, block, chain, chainId } = action.payload
		const fromAddress = action.payload.from

		assert(
			app === this.app || this.vm.sources.has(app),
			`action signed for wrong application (invalid app: expected ${this.app}, found ${app})`
		)

		assert(
			appName === this.vm.appName || this.vm.sources.has(app),
			"action signed for wrong application (invalid appName)"
		)

		// TODO: verify that actions signed for a previous app were valid within that app

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const [_, session] = await txn.getSessionByAddress(chain, chainId, action.session)
			assert(session !== null, "session not found")
			assert(
				action.payload.app === session.payload.app,
				"invalid session (action.payload.app and session.payload.app do not match)"
			)
			assert(session.payload.chain === action.payload.chain, "session and action chains must match")
			assert(session.payload.chainId === action.payload.chainId, `session and action chain IDs must match`)
			assert(session.payload.sessionIssued + session.payload.sessionDuration > timestamp, "session expired")
			assert(session.payload.sessionIssued <= timestamp, "session issued timestamp must precede action timestamp")

			assert(session.payload.app === app, "action referenced a session for the wrong application")
			assert(
				session.payload.from === fromAddress,
				"invalid session (action.payload.from and session.payload.from do not match)"
			)
		}

		const { verifyAction } = this.getChainImplementation(chain, chainId)
		await verifyAction(action)
	}

	private async validateSession(txn: ReadOnlyTransaction, session: Session) {
		const { app, appName, sessionIssued, block, chain, chainId } = session.payload

		assert(app === this.app || this.vm.sources.has(app), "session signed for wrong application (app invalid)")

		assert(
			appName === this.vm.appName || this.vm.sources.has(app),
			"session signed for wrong application (appName invalid)"
		)
		// check the timestamp bounds
		assert(sessionIssued > constants.BOUNDS_CHECK_LOWER_LIMIT, "session issued too far in the past")
		assert(sessionIssued < constants.BOUNDS_CHECK_UPPER_LIMIT, "session issued too far in the future")

		// TODO: verify that sessions signed for a previous app were valid within that app,
		// e.g. that their appName matches

		const { verifySession } = this.getChainImplementation(chain, chainId)
		await verifySession(session)
	}

	private async validateCustomAction(txn: ReadOnlyTransaction, customAction: CustomAction) {
		const customActionDefinition = this.vm.customAction
		assert(!!customActionDefinition, `custom action called but no custom action definition exists`)
		assert(
			customActionDefinition.name == customAction.name,
			`the custom action name in the message (${customAction.name}) does not match the action name in the contract ${customActionDefinition.name}`
		)
		const schemaValidationResult = await validate(this.vm.customActionSchemaName!, customAction.payload)
		assert(
			schemaValidationResult.valid,
			`custom action payload does not match the provided schema! ${schemaValidationResult.errors}`
		)
	}

	private getChainImplementation(chain: Chain, chainId: ChainId): ChainImplementation<unknown, unknown> {
		for (const implementation of this.chains) {
			if (implementation.chain === chain && implementation.chainId === chainId) {
				return implementation
			}
		}

		throw new Error(`Could not find matching chain implementation for ${chain}:${chainId}`)
	}
}
