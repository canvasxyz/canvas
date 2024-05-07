import { PeerId, TypedEventEmitter, CustomEvent, Connection } from "@libp2p/interface"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import type pg from "pg"

import { Signature, Action, Session, Message, Signer, SessionSigner, SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"
import { GossipLogService } from "@canvas-js/gossiplog/service"
import type { PresenceStore } from "@canvas-js/discovery"
import type { AbstractSessionSigner } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import type { ServiceMap } from "./targets/interface.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { validatePayload } from "./schema.js"

export interface NetworkConfig {
	offline?: boolean
	disablePing?: boolean

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number

	discoveryTopic?: string
	discoveryInterval?: number
	trackAllPeers?: boolean
	presenceTimeout?: number

	enableWebRTC?: boolean
}

export interface CanvasConfig<T extends Contract = Contract> extends NetworkConfig {
	contract: string | T
	signers?: SessionSigner[]

	/** data directory path (NodeJS/sqlite), or postgres connection config (NodeJS/pg) */
	path?: string | pg.ConnectionConfig | null

	/** provide an existing libp2p instance instead of creating a new one */
	libp2p?: Libp2p<ServiceMap>

	/** set to `false` to disable history indexing and db.get(..) within actions */
	indexHistory?: boolean

	/** set a memory limit for the quickjs runtime, only used if `contract` is a string */
	runtimeMemoryLimit?: number

	/** don't throw an error when invalid messages are received */
	ignoreMissingActions?: boolean

	reset?: boolean
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any> = (
	args: Args,
	options?: ActionOptions,
) => Promise<{ id: string; signature: Signature; message: Message<Action>; recipients: Promise<PeerId[]> }>

export type ConnectionsInfo = { connections: Connections; status: AppConnectionStatus }
export type PresenceInfo = { peer: PeerId; peers: PresenceStore }

export interface CanvasEvents extends GossipLogEvents<Action | Session> {
	close: Event
	connect: CustomEvent<{ peer: PeerId }>
	disconnect: CustomEvent<{ peer: PeerId }>
	"connections:updated": CustomEvent<ConnectionsInfo>
	"presence:join": CustomEvent<
		PresenceInfo & { peerId: PeerId; env: "browser" | "server"; address: string | null; topics: string[] }
	>
	"presence:leave": CustomEvent<PresenceInfo>
}

export type CanvasLogEvent = CustomEvent<{
	id: string
	signature: unknown
	message: Message<Action | Session>
}>

export type ApplicationData = {
	peerId: string
	topic: string
	models: Record<string, Model>
	actions: string[]
}
export { Model } from "@canvas-js/modeldb"

export type AppConnectionStatus = "connected" | "disconnected"
export type ConnectionStatus = "connecting" | "online" | "offline" | "waiting"
export type Connections = Record<string, { peer: PeerId; status: ConnectionStatus; connections: Connection[] }>
export { PeerId, Connection } from "@libp2p/interface"

export class Canvas<T extends Contract = Contract> extends TypedEventEmitter<CanvasEvents> {
	public static async initialize<T_ extends Contract>(config: CanvasConfig<T_>): Promise<Canvas<T_>> {
		const {
			path = null,
			contract,
			signers: initSigners = [],
			runtimeMemoryLimit,
			indexHistory = true,
			ignoreMissingActions = false,
			offline,
			disablePing,
			reset = false,
		} = config

		const signers = new SignerCache(initSigners.length === 0 ? [new SIWESigner()] : initSigners)
		const verifySignature = (signature: Signature, message: Message<Action | Session>) => {
			const signer = signers.getAll().find((signer) => signer.scheme.codecs.includes(signature.codec))
			assert(signer !== undefined, "no matching signer found")
			return signer.scheme.verify(signature, message)
		}

		const runtime = await createRuntime(path, signers, contract, {
			runtimeMemoryLimit,
			ignoreMissingActions,
			clearModelDB: reset,
		})

		const topic = runtime.topic

		const libp2p = await Promise.resolve(config.libp2p ?? target.createLibp2p({ topic, path }, { ...config, signers }))

		const gossipLog = await target.openGossipLog<Action | Session>(
			{ topic, path, clear: reset },
			{
				topic: runtime.topic,
				apply: runtime.getConsumer(),
				validatePayload: validatePayload,
				verifySignature: verifySignature,
				indexAncestors: indexHistory,
			},
		)

		await libp2p.services.gossiplog.subscribe(gossipLog, {})

		return new Canvas(signers, libp2p, gossipLog, runtime, offline, disablePing)
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof T["actions"]]: T["actions"][K] extends ActionImplementationFunction<infer Args>
			? ActionAPI<Args>
			: T["actions"][K] extends ActionImplementationObject<infer Args>
			? ActionAPI<Args>
			: never
	}

	public readonly connections: Connections = {}
	public status: AppConnectionStatus = "disconnected"

	// TODO: encapsulate internal stores for peers and connections
	private _peers: PeerId[] = []
	private _connections: Connection[] = []
	private _pingTimer: ReturnType<typeof setTimeout> | undefined

	private readonly _abortController = new AbortController()
	private readonly _log = logger("canvas:core")

	#open = true

	private constructor(
		public readonly signers: SignerCache,
		public readonly libp2p: Libp2p<ServiceMap>,
		public readonly messageLog: AbstractGossipLog<Action | Session>,
		private readonly runtime: Runtime,
		offline?: boolean,
		disablePing?: boolean,
	) {
		super()
		this.db = runtime.db

		this._log("initialized with peerId %p", libp2p.peerId)

		this.libp2p.addEventListener("peer:discovery", ({ detail: { id, multiaddrs } }) => {
			this._log("discovered peer %p with addresses %o", id, multiaddrs)
		})

		this.libp2p.addEventListener("peer:connect", ({ detail: peerId }) => {
			this._log("connected to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
			this._peers = [...this._peers, peerId]
		})

		this.libp2p.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this._log("disconnected %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
			this._peers = this._peers.filter((peer) => peer.toString() !== peerId.toString())
			delete this.connections[peerId.toString()]
			this.updateStatus()
		})

		this.libp2p.services.discovery.addEventListener(
			"presence:join",
			({ detail: { peerId, env, address, topics, peers } }) => {
				this._log("discovered peer %p with addresses %o", peerId)
				this.dispatchEvent(
					new CustomEvent("presence:join", { detail: { peerId, env, address, topics, peers: { ...peers } } }),
				)
			},
		)

		this.libp2p.services.discovery.addEventListener("presence:leave", ({ detail: { peerId, peers } }) => {
			this._log("discovered peer %p with addresses %o", peerId)
			this.dispatchEvent(new CustomEvent("presence:leave", { detail: { peerId, peers: { ...peers } } }))
		})

		this.libp2p.addEventListener("connection:open", ({ detail: connection }) => {
			this._connections = [...this._connections, connection]
			const remotePeerId = connection.remoteAddr.getPeerId()?.toString()
			if (remotePeerId && !this.connections[remotePeerId]) {
				const peer = this._peers.find((peer) => peer.toString() === remotePeerId)
				if (!peer) return
				this.connections[remotePeerId] = {
					peer,
					status: "connecting",
					connections: [connection],
				}
				this.dispatchEvent(
					new CustomEvent("connections:updated", { detail: { connections: this.connections, status: this.status } }),
				)
			}
		})
		this.libp2p.addEventListener("connection:close", ({ detail: connection }) => {
			this._connections = this._connections.filter(({ id }) => id !== connection.id)
			const remotePeerId = connection.remoteAddr.getPeerId()?.toString()
			if (remotePeerId && this.connections[remotePeerId]) {
				this.connections[remotePeerId].connections = this.connections[remotePeerId].connections.filter(
					({ id }) => id !== connection.id,
				)
				this.updateStatus()
			}
		})

		const startPingTimer = () => {
			this._pingTimer = setInterval(() => {
				const subscribers = this.libp2p.services.pubsub.getSubscribers(GossipLogService.topicPrefix + this.topic)
				const pings = this._peers.map((peer) =>
					this.libp2p.services.ping
						.ping(peer)
						.then((msec) => {
							this.connections[peer.toString()] = {
								peer,
								status: subscribers.find((p) => p.toString() === peer.toString()) ? "online" : "waiting",
								connections: this._connections.filter((conn) => conn.remotePeer.toString() === peer.toString()),
							}
						})
						.catch((err) => {
							this.connections[peer.toString()] = {
								peer,
								status: "offline",
								connections: this._connections.filter((conn) => conn.remotePeer.toString() === peer.toString()),
							}
						}),
				)
				Promise.allSettled(pings).then(() => {
					this.updateStatus()
					this.dispatchEvent(
						new CustomEvent("connections:updated", {
							detail: { connections: { ...this.connections }, status: this.status },
						}),
					)
				})
			}, 3000)
		}

		if (offline && !disablePing) {
			this.libp2p.addEventListener("start", (event) => startPingTimer())
		} else if (!disablePing) {
			startPingTimer()
		}

		this.libp2p.addEventListener("stop", (event) => clearInterval(this._pingTimer))

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
						blockhash: null,
						timestamp,
					},
					{ signer: session.signer },
				)

				this._log("applied action %s", id)

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

	private updateStatus() {
		const hasAnyOnline = Object.entries(this.connections).some(([peerId, conn]) => conn.status === "online")
		const newStatus = hasAnyOnline ? "connected" : "disconnected"
		if (this.status !== newStatus) {
			this.dispatchEvent(
				new CustomEvent("connections:updated", { detail: { connections: { ...this.connections }, status: newStatus } }),
			)
		}
		this.status = newStatus
	}

	public get peerId(): PeerId {
		return this.libp2p.peerId
	}

	public get topic(): string {
		return this.messageLog.topic
	}

	public async close() {
		if (this.#open) {
			this.#open = false
			this._abortController.abort()
			await this.libp2p.stop()
			await this.messageLog.close()
			await this.runtime.close()
			this.dispatchEvent(new CustomEvent("connections:updated", { detail: { connections: {} } }))
			this.dispatchEvent(new Event("close"))
			this._log("closed")
		}
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
	public async insert(signature: Signature, message: Message<Session | Action>): Promise<{ id: string }> {
		assert(message.topic === this.topic, "invalid message topic")
		const { id } = await this.libp2p.services.gossiplog.insert(signature, message)
		return { id }
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
		options: { signer?: Signer<Payload> },
	): Promise<{ id: string; signature: Signature; message: Message<Payload>; recipients: Promise<PeerId[]> }> {
		return this.libp2p.services.gossiplog.append(this.topic, payload, options)
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
