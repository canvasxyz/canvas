import { PeerId, TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { sha256 } from "@noble/hashes/sha2"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import type pg from "pg"

import { Signature, Action, Session, Message, Signer, SessionSigner, SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"
import type { AbstractSessionSigner } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import type { ServiceMap } from "./targets/interface.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { validatePayload } from "./schema.js"

export type { Model } from "@canvas-js/modeldb"
export type { PeerId } from "@libp2p/interface"

export interface NetworkConfig {
	start?: boolean

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
}

export interface CanvasConfig<T extends Contract = Contract> extends NetworkConfig {
	topic?: string
	contract: string | T
	signers?: SessionSigner[]

	/** data directory path (NodeJS/sqlite), or postgres connection config (NodeJS/pg) */
	path?: string | pg.ConnectionConfig | null

	/** set to `false` to disable history indexing and db.get(..) within actions */
	indexHistory?: boolean

	/** set a memory limit for the quickjs runtime, only used if `contract` is a string */
	runtimeMemoryLimit?: number

	reset?: boolean
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any> = (
	args: Args,
	options?: ActionOptions,
) => Promise<{ id: string; signature: Signature; message: Message<Action>; recipients: Promise<PeerId[]> }>

export interface CanvasEvents extends GossipLogEvents<Action | Session> {
	stop: Event
	connect: CustomEvent<{ peer: string }>
	disconnect: CustomEvent<{ peer: string }>
}

export type CanvasLogEvent = CustomEvent<{
	id: string
	signature: unknown
	message: Message<Action | Session>
}>

export type ApplicationData = {
	topic: string
	models: Record<string, Model>
	actions: string[]

	peerId: string
}

export class Canvas<T extends Contract = Contract> extends TypedEventEmitter<CanvasEvents> {
	public static async initialize<T_ extends Contract>(config: CanvasConfig<T_>): Promise<Canvas<T_>> {
		const {
			path = null,
			contract,
			signers: initSigners = [],
			runtimeMemoryLimit,
			indexHistory = true,
			reset = false,
		} = config

		const signers = new SignerCache(initSigners.length === 0 ? [new SIWESigner()] : initSigners)

		const verifySignature = (signature: Signature, message: Message<Action | Session>) => {
			const signer = signers.getAll().find((signer) => signer.scheme.codecs.includes(signature.codec))
			assert(signer !== undefined, "no matching signer found")
			return signer.scheme.verify(signature, message)
		}

		let topic = config.topic
		if (topic === undefined) {
			if (typeof contract === "string") {
				topic = bytesToHex(sha256(contract))
			} else {
				topic = bytesToHex(randomBytes(32))
			}
		}

		const runtime = await createRuntime(path, topic, signers, contract, {
			runtimeMemoryLimit,
			clearModelDB: reset,
			indexHistory: indexHistory,
		})

		const messageLog = await target.openGossipLog(
			{ topic, path, clear: reset },
			{
				topic: runtime.topic,
				apply: runtime.getConsumer(),
				validatePayload: validatePayload,
				verifySignature: verifySignature,
				indexAncestors: indexHistory,
			},
		)

		const libp2p = await target.createLibp2p(messageLog, { ...config, signers })

		return new Canvas(signers, messageLog, libp2p, runtime)
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof T["actions"]]: T["actions"][K] extends ActionImplementationFunction<infer Args>
			? ActionAPI<Args>
			: T["actions"][K] extends ActionImplementationObject<infer Args>
				? ActionAPI<Args>
				: never
	}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	private constructor(
		public readonly signers: SignerCache,
		public readonly messageLog: AbstractGossipLog<Action | Session>,
		public readonly libp2p: Libp2p<ServiceMap>,
		private readonly runtime: Runtime,
	) {
		super()
		this.db = runtime.db

		this.log("initialized with peerId %p", libp2p.peerId)

		this.libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) => {
			this.log("discovered peer %p with addresses %o", id, multiaddrs)
		})

		this.libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
			this.log("connected to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		this.libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this.log("disconnected %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))

		for (const name of runtime.actionNames) {
			const action: ActionAPI = async (args: any, options: ActionOptions = {}) => {
				const timestamp = Date.now()

				const sessionSigner = (options.signer ?? signers.getFirst()) as AbstractSessionSigner<any>
				assert(sessionSigner !== undefined, "signer not found")

				let session = await sessionSigner.getSession(this.topic)

				// check that a session for the delegate signer exists in the log and hasn't expired
				if (session !== null) {
					const sessionIds = await this.getSessions({
						address: session.payload.address,
						publicKey: session.signer.publicKey,
						minExpiration: timestamp,
					})

					if (sessionIds.length === 0) {
						session = null
					}
				}

				// if the delegate signer doesn't exist, or if the session expired,
				// create and append a new one
				if (session === null) {
					session = await sessionSigner.newSession(this.topic)
					await this.append(session.payload, { signer: session.signer })
				}

				const argsTransformer = runtime.argsTransformers[name]
				assert(argsTransformer !== undefined, "invalid action name")

				const argsRepresentation = argsTransformer.toRepresentation(args)
				assert(argsRepresentation !== undefined, "action args did not validate the provided schema type")

				const { id, signature, message, recipients } = await this.append<Action>(
					{
						type: "action",
						address: session.payload.address,
						name,
						args: argsRepresentation,
						context: {
							timestamp,
						},
					},
					{ signer: session.signer },
				)

				this.log("applied action %s", id)

				return { id, signature, message, recipients }
			}

			Object.assign(this.actions, { [name]: action })
		}
	}

	/**
	 * Get existing sessions
	 */
	public async getSessions(query: {
		address: string
		publicKey: string
		minExpiration?: number
	}): Promise<{ id: string; address: string; publicKey: string; expiration: number | null }[]> {
		const sessions = await this.db.query<{
			message_id: string
			public_key: string
			address: string
			expiration: number
		}>("$sessions", {
			select: { message_id: true, public_key: true, address: true, expiration: true },
			where: {
				public_key: query.publicKey,
				address: query.address,
				expiration: { gte: query.minExpiration ?? 0 },
			},
		})

		return sessions.map(({ message_id, public_key, address, expiration }) => ({
			id: message_id,
			publicKey: public_key,
			address,
			expiration: expiration === Number.MAX_SAFE_INTEGER ? null : expiration,
		}))
	}

	public updateSigners(signers: SessionSigner[]) {
		this.signers.updateSigners(signers)
	}

	public get peerId(): PeerId {
		return this.libp2p.peerId
	}

	public get topic(): string {
		return this.messageLog.topic
	}

	public async stop() {
		this.controller.abort()
		await this.libp2p.stop()
		await this.messageLog.close()
		await this.runtime.close()
		this.log("stopped")
		this.dispatchEvent(new Event("stop"))
	}

	public getApplicationData(): ApplicationData {
		const models = Object.fromEntries(Object.entries(this.db.models).filter(([name]) => !name.startsWith("$")))
		return {
			peerId: this.peerId.toString(),
			topic: this.topic,
			models: models,
			actions: Object.keys(this.actions),
		}
	}

	/**
	 * Insert an existing signed message into the log (ie received via PubSub)
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async insert(
		signature: Signature,
		message: Message<Session | Action>,
	): Promise<{ id: string; recipients: Promise<PeerId[]> }> {
		assert(message.topic === this.topic, "invalid message topic")
		const { id, recipients } = await this.libp2p.services.gossiplog.insert(signature, message)
		return { id, recipients }
	}

	/**
	 * Append a new unsigned message to the end of the log (ie an action generated locally)
	 * Low-level utility method for internal and debugging use.
	 *
	 * The default signer on the message log will be used if none is provided.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async append<Payload extends Session | Action>(
		payload: Payload,
		options: { signer?: Signer<Session | Action> },
	): Promise<{ id: string; signature: Signature; message: Message<Payload>; recipients: Promise<PeerId[]> }> {
		const { id, signature, message, recipients } = await this.libp2p.services.gossiplog.append(payload, options)
		return { id, signature, message: message as Message<Payload>, recipients }
	}

	public async getMessage(
		id: string,
	): Promise<[signature: Signature, message: Message<Action | Session>] | [null, null]> {
		return await this.messageLog.get(id)
	}

	public async *getMessages(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[id: string, signature: Signature, message: Message<Action | Session>]> {
		yield* this.messageLog.iterate(lowerBound, upperBound, options)
	}

	/**
	 * Get an existing session
	 */
	public async getSession(query: { address: string; publicKey: string; timestamp?: number }): Promise<string | null> {
		const sessions = await this.db.query<{ message_id: string }>("$sessions", {
			where: {
				public_key: query.publicKey,
				address: query.address,
				expiration: { gte: query.timestamp ?? 0 },
			},
		})

		if (sessions.length === 0) {
			return null
		} else {
			return sessions[0].message_id
		}
	}
}
