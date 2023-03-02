import assert from "node:assert"

import Hash from "ipfs-only-hash"
import { sha256 } from "@noble/hashes/sha256"
import { CID } from "multiformats/cid"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { createLibp2p, Libp2p } from "libp2p"
import type { PeerId } from "@libp2p/interface-peer-id"

import {
	Action,
	Session,
	ModelValue,
	Chain,
	ChainId,
	Message,
	ChainImplementation,
	CustomAction,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { validate } from "@hyperjump/json-schema/draft-2020-12"

import { actionType, messageType } from "./codecs.js"
import { toHex, signalInvalidType, CacheMap, stringify, parseIPFSURI } from "./utils.js"

import { VM } from "@canvas-js/core/components/vm"
import { ModelStore, openModelStore } from "@canvas-js/core/components/modelStore"
import { MessageStore, openMessageStore } from "@canvas-js/core/components/messageStore"

import { getLibp2pOptions, startPingService } from "@canvas-js/core/components/libp2p"
import * as constants from "./constants.js"
import { Source } from "./source.js"
import { metrics } from "./metrics.js"
import chalk from "chalk"

export interface CoreConfig extends CoreOptions {
	// pass `null` to run in memory (NodeJS only)
	directory: string | null
	spec: string

	uri?: string
	chains?: ChainImplementation<unknown, unknown>[]
	peerId?: PeerId
	port?: number
	announce?: string[]
	bootstrapList?: string[]
}

export interface CoreOptions {
	unchecked?: boolean
	verbose?: boolean
	offline?: boolean
	replay?: boolean
}

interface CoreEvents {
	close: Event
	message: CustomEvent<Message>
}

export class Core extends EventEmitter<CoreEvents> {
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
			const { peerId, port, announce, bootstrapList } = config
			libp2p = await getLibp2pOptions({ peerId, port, announce, bootstrapList }).then(createLibp2p)
		}

		const core = new Core(directory, cid, app, vm, modelStore, messageStore, libp2p, chains, { verbose, unchecked })

		if (config.replay) {
			console.log(chalk.green(`[canvas-cli] Replaying action log...`))
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

	public readonly recentGossipPeers = new CacheMap<string, { lastSeen: number }>(1000)
	public readonly recentSyncPeers = new CacheMap<string, { lastSeen: number }>(1000)
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

		if (libp2p !== null) {
			this.sources = {}
			for (const uri of [this.app, ...vm.sources]) {
				this.sources[uri] = new Source({
					cid: parseIPFSURI(uri),
					applyMessage: this.applyMessageInternal,
					messageStore: this.messageStore,
					libp2p,
					recentGossipPeers: this.recentGossipPeers,
					recentSyncPeers: this.recentSyncPeers,
					...options,
				})
			}

			if (this.options.verbose) {
				libp2p.addEventListener("peer:connect", ({ detail: { id, remotePeer } }) =>
					console.log(`[canvas-core] Connected to ${remotePeer} (${id})`)
				)

				libp2p.addEventListener("peer:disconnect", ({ detail: { id, remotePeer } }) =>
					console.log(`[canvas-core] Disconnected from ${remotePeer} (${id})`)
				)
			}
		}
	}

	public get appName() {
		return this.vm.appName
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

	public getChainImplementations(): Partial<Record<Chain, Record<string, { rpc: boolean }>>> {
		const result: Partial<Record<Chain, Record<ChainId, { rpc: boolean }>>> = {}

		for (const ci of this.chains) {
			const chainIds = result[ci.chain]
			if (chainIds !== undefined) {
				chainIds[ci.chainId] = { rpc: ci.hasProvider() }
			} else {
				result[ci.chain] = { [ci.chainId]: { rpc: ci.hasProvider() } }
			}
		}

		return result
	}

	public async getRoute(route: string, params: Record<string, string>): Promise<Record<string, ModelValue>[]> {
		if (this.options.verbose) {
			console.log("[canvas-core] getRoute:", route, params)
		}

		return await this.modelStore.getRoute(route, params)
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

				await this.applyMessageInternal(hash, message)
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
	private applyMessageInternal = async (hash: Uint8Array, message: Message) => {
		const id = toHex(hash)

		if (this.options.verbose) {
			console.log(`[canvas-core] Applying ${message.type} ${id}`, message)
		}

		if (message.type === "action") {
			await this.validateAction(message)

			const effects = await this.vm.execute(hash, message.payload)

			this.modelStore.applyEffects(message.payload, effects)

			metrics.canvas_messages.inc({ type: "action", uri: message.payload.app }, 1)
		} else if (message.type === "session") {
			await this.validateSession(message)

			metrics.canvas_messages.inc({ type: "session", uri: message.payload.app }, 1)
		} else if (message.type == "customAction") {
			await this.validateCustomAction(message)

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

			metrics.canvas_messages.inc({ type: "customAction", uri: message.app }, 1)
		} else {
			signalInvalidType(message)
		}

		this.dispatchEvent(new CustomEvent("message", { detail: message }))
	}

	private async validateAction(action: Action) {
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
			const [_, session] = await this.messageStore.getSessionByAddress(chain, chainId, action.session)
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

	private async validateSession(session: Session) {
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

	private async validateCustomAction(customAction: CustomAction) {
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
