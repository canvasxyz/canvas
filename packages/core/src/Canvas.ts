import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interface/events"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { base32hex } from "multiformats/bases/base32"
import { bytesToHex, bytesToHex as hex } from "@noble/hashes/utils"
import { equals } from "uint8arrays"

import { Action, ActionArguments, Session, Message, SessionSigner } from "@canvas-js/interfaces"
import { JSValue } from "@canvas-js/vm"
import { AbstractModelDB, Model, ModelsInit } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Signature } from "@canvas-js/signed-cid"
import { AbstractGossipLog, MessageSigner } from "@canvas-js/gossiplog"

import getTarget from "#target"

import { ActionImplementation, GenericActionImplementation, Runtime, getRuntime } from "./runtime.js"
import { ServiceMap } from "./targets/interface.js"
import { assert, signalInvalidType } from "./utils.js"

export type ApplyMessage = (
	id: string,
	signature: Signature | null,
	message: Message<Action | Session>,
) => Promise<JSValue | void>

export interface TemplateInlineContract {
	models: ModelsInit
	actions: Record<string, GenericActionImplementation>
}

export interface GenericInlineContract extends TemplateInlineContract {
	topic: string
	models: ModelsInit
	actions: Record<string, GenericActionImplementation>
}

export interface InlineContract extends GenericInlineContract {
	topic: string
	models: ModelsInit
	actions: Record<string, ActionImplementation>
}

export interface CanvasConfig {
	contract: string | InlineContract

	/** NodeJS: data directory path; browser: IndexedDB database namespace */
	location?: string | null

	signers?: SessionSigner[]
	replay?: boolean
	runtimeMemoryLimit?: number

	offline?: boolean
	start?: boolean
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export type ActionAPI = (
	args: ActionArguments,
	options?: { chain?: string; signer?: SessionSigner },
) => Promise<{ id: string; result: void | JSValue; recipients: Promise<PeerId[]> }>

export interface CoreEvents {
	close: Event
	// TODO: should this be {signature: Signature, Message: Message} ?
	message: CustomEvent<{}>
	// TODO: what should this be
	update: CustomEvent<{}>
	// TODO: what should this be
	sync: CustomEvent<{}>
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
}

export type ApplicationData = {
	peerId: string
	models: Record<string, Model>
	topics: Record<string, { actions: string[] | null }>
}

export class Canvas extends EventEmitter<CoreEvents> {
	public static async initialize(config: CanvasConfig): Promise<Canvas> {
		const { contract, location = null, signers = [], runtimeMemoryLimit, replay = false, offline = false } = config

		const target = getTarget(location)

		const runtime = await getRuntime(target, contract, { runtimeMemoryLimit })
		const db = runtime.db

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const peerId = await target.getPeerId()
		let libp2p: Libp2p<ServiceMap> | null = null
		if (!offline) {
			libp2p = await target.createLibp2p(config, peerId)
		}

		const sessionDB = await target.openDB("sessions", Canvas.sessionSchema)

		const apply = async (id: string, signature: Signature | null, message: Message<Action | Session>) => {
			assert(signature !== null, "missing message signature")

			if (message.payload.type === "action") {
				const { chain, address, timestamp } = message.payload

				const sessions = await sessionDB.query("sessions", {
					where: {
						public_key_type: signature.type,
						public_key: signature.publicKey,
						chain: chain,
						address: address,
						expiration: { gt: timestamp },
					},
				})

				if (sessions.length === 0) {
					throw new Error(`missing session [${signature.type} 0x${hex(signature.publicKey)}] for ${chain}:${address}`)
				}

				const { result, effects } = await runtime.execute(id, message.payload)

				await db.apply(effects, { version: base32hex.baseDecode(id) })

				return result
			} else if (message.payload.type === "session") {
				const { publicKeyType, publicKey, chain, address, timestamp, duration } = message.payload

				const signer = signers.find((signer) => signer.match(chain))
				assert(signer !== undefined, "no signer found")

				assert(publicKeyType === signature.type && equals(publicKey, signature.publicKey))
				await signer.verifySession(message.payload)

				await sessionDB.set("sessions", `${signature.type}:${bytesToHex(signature.publicKey)}`, {
					message_id: id,
					chain: chain,
					address: address,
					public_key_type: signature.type,
					public_key: signature.publicKey,
					expiration: duration === null ? Number.MAX_SAFE_INTEGER : timestamp + duration,
				})
			} else {
				signalInvalidType(message.payload)
			}
		}

		const gossipLog = await target.openGossipLog({
			topic: runtime.topic,
			apply,
			replay,
			validate: Canvas.validate,
			signatures: true,
			sequencing: true,
		})

		await libp2p?.services.gossiplog.subscribe(gossipLog, {})

		return new Canvas(signers, peerId, libp2p, db, sessionDB, gossipLog, runtime)
	}

	private static validate = (payload: unknown): payload is Action | Session => true // TODO

	private static sessionSchema = {
		sessions: {
			message_id: "string",
			chain: "string",
			address: "string",
			public_key_type: "string",
			public_key: "bytes",
			expiration: "integer?",
			$indexes: [["address"], ["public_key"]],
		},
	} satisfies ModelsInit

	public readonly actions: Record<string, ActionAPI> = {}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	#open = true

	private constructor(
		public readonly signers: SessionSigner[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly db: AbstractModelDB,
		public readonly sessionDB: AbstractModelDB,
		public readonly messageLog: AbstractGossipLog<Action | Session, JSValue | void>,
		private readonly runtime: Runtime,
	) {
		super()

		libp2p?.addEventListener("peer:discovery", ({ detail: { id, multiaddrs, protocols } }) => {
			this.log("discovered peer %p with protocols %o", id, protocols)
		})

		libp2p?.addEventListener("peer:connect", ({ detail: peerId }) => {
			this.log("connected to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		libp2p?.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this.log("disconnected %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})

		for (const name of runtime.actionNames) {
			this.actions[name] = async (args, options = {}) => {
				const signer =
					options.signer ?? signers.find((signer) => options.chain === undefined || signer.match(options.chain))
				assert(signer !== undefined, "signer not found")

				const timestamp = Date.now()

				const session = await signer.getSession(this.topic, { timestamp, chain: options.chain })

				const { chain, address, publicKeyType: public_key_type, publicKey: public_key } = session

				// Check if the session has already been added to the message log
				const results = await sessionDB.query("sessions", {
					where: { chain, address, public_key_type, public_key, expiration: { gt: timestamp } },
					limit: 1,
				})

				this.log("got %d matching sessions: %o", results.length, results)

				if (results.length === 0) {
					const { id: sessionId } = await this.append(session, { signer })
					this.log("created session %s", sessionId)
				}

				const { id, result, recipients } = await this.append(
					{ type: "action", chain, address, name, args, blockhash: null, timestamp },
					{ signer },
				)

				this.log("applied action %s and got result %o", id, result)

				return { id, result, recipients }
			}
		}
	}

	public get topic(): string {
		return this.messageLog.topic
	}

	public async start() {
		await this.libp2p?.start()
	}

	public async stop() {
		await this.libp2p?.stop()
	}

	public async close() {
		if (this.#open) {
			this.#open = false
			this.controller.abort()
			await this.libp2p?.stop()
			await this.messageLog.close()
			await this.db.close()
			await this.sessionDB.close()
			await this.runtime.close()
			this.dispatchEvent(new Event("close"))
			this.log("closed")
		}
	}

	public getApplicationData(): ApplicationData {
		return {
			peerId: this.peerId.toString(),
			models: this.db.models,
			topics: { [this.topic]: { actions: Object.keys(this.actions) } },
		}
	}

	/**
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async insert(signature: Signature | null, message: Message<Session | Action>): Promise<{ id: string }> {
		if (this.libp2p === null) {
			return this.messageLog.insert(signature, message)
		} else {
			const { id } = await this.libp2p.services.gossiplog.insert(this.topic, signature, message)
			return { id }
		}
	}

	/**
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async append(
		payload: Session | Action,
		options: { signer?: MessageSigner<Session | Action> },
	): Promise<{ id: string; result: void | JSValue; recipients: Promise<PeerId[]> }> {
		if (this.libp2p === null) {
			const { id, result } = await this.messageLog.append(payload, options)
			return { id, result, recipients: Promise.resolve([]) }
		} else {
			return this.libp2p.services.gossiplog.append(this.topic, payload, options)
		}
	}

	public async getMessage(
		id: string,
	): Promise<[signature: Signature | null, message: Message<Action | Session> | null]> {
		return await this.messageLog.get(id)
	}

	public async *getMessageStream<Payload = Action>(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[id: string, signature: Signature | null, message: Message<Payload>]> {
		for await (const [id, signature, message] of this.messageLog.iterate(lowerBound, upperBound, options)) {
			yield [id, signature, message as Message<Payload>]
		}
	}
}
