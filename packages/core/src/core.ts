import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"
import { createHash } from "node:crypto"

import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"
import { EventEmitter, CustomEvent } from "@libp2p/interfaces/events"
import { Libp2p } from "libp2p"

import {
	Action,
	ActionPayload,
	Session,
	SessionPayload,
	ModelValue,
	Chain,
	ChainId,
	Message,
	ChainImplementation,
} from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { actionType, sessionType } from "./codecs.js"
import { toHex, signalInvalidType, CacheMap, parseIPFSURI, stringify, mapEntries } from "./utils.js"

import { VM } from "./vm/index.js"
import { MessageStore } from "./messageStore.js"
import { ModelStore } from "./modelStore.js"

import * as constants from "./constants.js"
import { Source } from "./source.js"
import { metrics } from "./metrics.js"
import { MST } from "./mst.js"
import { getMessageKey } from "./rpc/utils.js"

export interface CoreConfig extends CoreOptions {
	// pass `null` to run in memory
	directory: string | null

	// defaults to ipfs:// hash of application
	uri?: string
	spec: string
	libp2p: Libp2p | null // pass null to run offline
	chains?: ChainImplementation<unknown, unknown>[]
}

export interface CoreOptions {
	unchecked?: boolean
	verbose?: boolean
}

interface CoreEvents {
	close: Event
	error: Event
	action: CustomEvent<ActionPayload>
	session: CustomEvent<SessionPayload>
}

export class Core extends EventEmitter<CoreEvents> {
	public readonly recentGossipPeers = new CacheMap<string, { lastSeen: number }>(1000)
	public readonly recentSyncPeers = new CacheMap<string, { lastSeen: number }>(1000)

	private readonly sources: Record<string, Source> | null = null

	public static async initialize(config: CoreConfig) {
		const { directory, uri, spec, libp2p, chains = [new EthereumChainImplementation()], ...options } = config

		const cid = await Hash.of(spec).then(CID.parse)
		const app = uri ?? `ipfs://${cid}`
		const vm = await VM.initialize({ app, spec, chains, ...options })
		const appName = vm.appName

		const modelStore = new ModelStore(directory, vm, options)
		const messageStore = new MessageStore(app, directory, vm.sources, options)

		let mst: MST | null = null
		if (directory !== null) {
			// only called if the MST directory does not exist
			async function* importMessages(dbi: string): AsyncIterable<[Buffer, Message]> {
				if (options.verbose) {
					console.log(`[canvas-core] Rebuilding MST index ${dbi} from model store`)
				}

				yield* messageStore.getSessionStream({ app: dbi })
				yield* messageStore.getActionStream({ app: dbi })
			}

			mst = await MST.initialize(directory, [app, ...vm.sources], importMessages, options)
		}

		return new Core(directory, cid, app, appName, vm, modelStore, messageStore, mst, libp2p, chains, options)
	}

	private constructor(
		public readonly directory: string | null,
		public readonly cid: CID,
		public readonly app: string,
		public readonly appName: string,
		public readonly vm: VM,
		public readonly modelStore: ModelStore,
		public readonly messageStore: MessageStore,
		public readonly mst: MST | null,
		public readonly libp2p: Libp2p | null,
		private readonly chains: ChainImplementation<unknown, unknown>[],
		public readonly options: CoreOptions
	) {
		super()

		this.options = options

		if (mst !== null) {
			const sourceCIDs: Record<string, CID> = { [this.app]: this.cid }
			for (const uri of vm.sources) {
				sourceCIDs[uri] = parseIPFSURI(uri)
			}

			this.sources = mapEntries(sourceCIDs, (_, cid) =>
				Source.initialize({
					cid,
					mst,
					applyMessage: this.applyMessage,
					messageStore: this.messageStore,
					libp2p,
					recentGossipPeers: this.recentGossipPeers,
					recentSyncPeers: this.recentSyncPeers,
					...options,
				})
			)
		}
	}

	public async close() {
		if (this.sources !== null) {
			await Promise.all(Object.values(this.sources).map((source) => source.close()))
		}

		if (this.mst !== null) {
			await this.mst.close()
		}

		await this.vm.close()
		this.messageStore.close()
		this.modelStore.close()

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
		assert(actionType.is(action), "invalid action object")
		assert(action.payload.app === this.app, `expected action.payload.app to be ${this.app}`)

		const data = Buffer.from(stringify(action))
		const hash = createHash("sha256").update(data).digest()

		await this.applyMessage(hash, action)

		if (this.mst !== null) {
			await this.mst.write(this.app, (txn) => {
				txn.set(getMessageKey(hash, action), hash)
			})
		}

		if (this.sources !== null) {
			await this.sources[this.app].publishMessage(hash, data)
		}

		return { hash: toHex(hash) }
	}

	/**
	 * Apply a new session. This is a "local" entrypoint and can only be used for
	 * sessions signed for the root app (session.payload.app === this.app).
	 * It applies the message, inserts it into the MST, and publishes to GossipSub.
	 */
	public async applySession(session: Session): Promise<{ hash: string }> {
		assert(sessionType.is(session), "invalid session object")
		assert(session.payload.app === this.app, `expected session.payload.app to be ${this.app}`)

		const data = Buffer.from(stringify(session))
		const hash = createHash("sha256").update(data).digest()

		await this.applyMessage(hash, session)

		if (this.mst !== null) {
			await this.mst.write(this.app, (txn) => {
				txn.set(getMessageKey(hash, session), hash)
			})
		}

		if (this.sources !== null) {
			await this.sources[this.app].publishMessage(hash, data)
		}

		return { hash: toHex(hash) }
	}

	/**
	 * Apply a message.
	 * For actions: validate, execute, apply effects, insert into message store.
	 * For sessions: validate, insert into message store.
	 * This method is called directly from Core.applySession and Core.applyAction and is
	 * also passed to Source as the callback for GossipSub and MST sync messages.
	 * Note the this does NOT insert into the MST or publish to GossipSub -
	 * that's the responsibility of the caller.
	 */
	private applyMessage = async (hash: Buffer, message: Message) => {
		const id = toHex(hash)
		if (message.type === "action") {
			const existingRecord = this.messageStore.getActionByHash(hash)
			if (existingRecord !== null) {
				return
			}

			if (this.options.verbose) {
				console.log(`[canvas-core] Applying action ${id}`, message)
			}

			await this.validateAction(message)

			const effects = await this.vm.execute(id, message.payload)

			this.modelStore.applyEffects(message.payload, effects)

			this.messageStore.insertAction(hash, message)

			this.dispatchEvent(new CustomEvent("action", { detail: message.payload }))
			metrics.canvas_messages.inc({ type: "action", uri: message.payload.app }, 1)
		} else if (message.type === "session") {
			const existingRecord = this.messageStore.getSessionByHash(hash)
			if (existingRecord !== null) {
				return
			}

			if (this.options.verbose) {
				console.log(`[canvas-core] Applying session ${id}`, message)
			}

			await this.validateSession(message)

			this.messageStore.insertSession(hash, message)

			this.dispatchEvent(new CustomEvent("session", { detail: message.payload }))
			metrics.canvas_messages.inc({ type: "session", uri: message.payload.app }, 1)
		} else {
			signalInvalidType(message)
		}
	}

	private async validateAction(action: Action) {
		const { timestamp, app, appName, block, chain, chainId } = action.payload
		const fromAddress = action.payload.from

		assert(
			app === this.app || this.vm.sources.has(app),
			`action signed for wrong application (invalid app: expected ${this.app}, found ${app})`
		)
		assert(
			appName === this.appName || this.vm.sources.has(app),
			"action signed for wrong application (invalid appName)"
		)

		// TODO: verify that actions signed for a previous app were valid within that app

		// check the timestamp bounds
		assert(timestamp > constants.BOUNDS_CHECK_LOWER_LIMIT, "action timestamp too far in the past")
		assert(timestamp < constants.BOUNDS_CHECK_UPPER_LIMIT, "action timestamp too far in the future")

		// if (!this.options.unchecked) {
		// 	// check the action was signed with a valid, recent block
		// 	assert(block, "action is missing block data")
		// 	await this.validateBlock({ blockhash: block, chain, chainId })
		// }

		// verify the signature, either using a session signature or action signature
		if (action.session !== null) {
			const { session } = this.messageStore.getSessionByAddress(chain, chainId, action.session)
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
			appName === this.appName || this.vm.sources.has(app),
			"session signed for wrong application (appName invalid)"
		)

		// TODO: verify that sessions signed for a previous app were valid within that app,
		// e.g. that their appName matches

		const { verifySession } = this.getChainImplementation(chain, chainId)
		await verifySession(session)

		// check the timestamp bounds
		assert(sessionIssued > constants.BOUNDS_CHECK_LOWER_LIMIT, "session issued too far in the past")
		assert(sessionIssued < constants.BOUNDS_CHECK_UPPER_LIMIT, "session issued too far in the future")

		// if (!this.options.unchecked) {
		// 	// check the session was signed with a valid, recent block
		// 	assert(block, "session is missing block data")
		// 	await this.validateBlock({ blockhash: block, chain, chainId })
		// }
	}

	private getChainImplementation(chain: Chain, chainId: ChainId): ChainImplementation<unknown, unknown> {
		for (const implementation of this.chains) {
			if (implementation.chain === chain && implementation.chainId === chainId) {
				return implementation
			}
		}

		throw new Error(`Could not find matching chain implementation for ${chain}:${chainId}`)
	}

	// /**
	//  * Helper for verifying the blockhash for an action or session.
	//  */
	// private async validateBlock({ chain, chainId, blockhash }: { chain: Chain; chainId: ChainId; blockhash: string }) {
	// 	assert(this.blockResolver !== null, "missing blockResolver")
	// 	const block = await this.blockResolver(chain, chainId, blockhash)
	// 	// TODO: add blocknums to messages, verify blocknum and blockhash match
	// }
}
