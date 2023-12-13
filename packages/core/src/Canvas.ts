import { PeerId, TypedEventEmitter, CustomEvent, Connection, Libp2pEvents } from "@libp2p/interface"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import * as cbor from "@ipld/dag-cbor"
import { hexToBytes } from "@noble/hashes/utils"
import { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub"

import { Action, Session, Message, Signer, SessionSigner } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Signature } from "@canvas-js/signed-cid"
import { AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"
import { GossipLogService } from "@canvas-js/gossiplog/service"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import type { ServiceMap } from "./targets/interface.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { validatePayload } from "./schema.js"
import { assert } from "./utils.js"
import { startPingService } from "./ping.js"
import { second } from "./constants.js"

export interface NetworkConfig {
	offline?: boolean

	/** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
	listen?: string[]

	/** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
	announce?: string[]

	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
	discoveryTopic?: string
	discoveryInterval?: number
	enableWebRTC?: boolean

	disablePing?: boolean
	pingInterval?: number
}

export interface CanvasConfig<T extends Contract = Contract> extends NetworkConfig {
	contract: string | T

	/** data directory path (NodeJS only) */
	path?: string | null
	signers?: SessionSigner[]

	/** provide an existing libp2p instance instead of creating a new one */
	libp2p?: Libp2p<ServiceMap>

	/** set to `false` to disable history indexing and db.get(..) within actions */
	indexHistory?: boolean
	runtimeMemoryLimit?: number
	ignoreMissingActions?: boolean
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any, Result = any> = (
	args: Args,
	options?: ActionOptions,
) => Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }>

export interface CanvasEvents extends GossipLogEvents<Action | Session, unknown> {
	close: Event
	connect: CustomEvent<{ peer: PeerId }>
	disconnect: CustomEvent<{ peer: PeerId }>
	"connections:updated": CustomEvent<{ connections: Connections; status: AppConnectionStatus }>
}

export type CanvasLogEvent = CustomEvent<{
	id: string
	signature: unknown
	message: Message<Action | Session>
	result: unknown
}>

export type ApplicationData = {
	peerId: string
	topic: string
	models: Record<string, Model>
	actions: string[]
}

export type AppConnectionStatus = "connected" | "disconnected"
export type ConnectionStatus = "connecting" | "online" | "offline" | "waiting"
export type Connections = Record<string, { peer: PeerId; status: ConnectionStatus; connections: Connection[] }>

export class Canvas<T extends Contract = Contract> extends TypedEventEmitter<CanvasEvents> {
	public static async initialize<T extends Contract>(config: CanvasConfig<T>): Promise<Canvas<T>> {
		const {
			path = null,
			contract,
			signers = [],
			runtimeMemoryLimit,
			indexHistory = true,
			ignoreMissingActions = false,
			disablePing = false,
			pingInterval = 3 * second,
		} = config

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const runtime = await createRuntime(path, signers, contract, { runtimeMemoryLimit, ignoreMissingActions })

		const topic = runtime.topic

		const controller = new AbortController()

		let libp2p = config.libp2p
		if (libp2p === undefined) {
			libp2p = await target.createLibp2p({ topic, path }, config)
			controller.signal.addEventListener("abort", () => libp2p?.stop())

			if (!disablePing) {
				startPingService(libp2p, controller.signal, pingInterval)
			}
		}

		const gossipLog = await target.openGossipLog<Action | Session, void | any>(
			{ topic, path },
			{
				topic: runtime.topic,
				apply: runtime.getConsumer(),
				validate: validatePayload,
				indexAncestors: indexHistory,
			},
		)

		await libp2p.services.gossiplog.subscribe(gossipLog, {})

		const app = new Canvas<T>(controller, runtime, signers, libp2p, gossipLog)

		if (config.libp2p === undefined) {
			app.addEventListener("close", (event) => app.libp2p.stop(), { once: true })
		}

		return app
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof T["actions"]]: T["actions"][K] extends ActionImplementationFunction<infer Args, infer Result>
			? ActionAPI<Args, Result>
			: T["actions"][K] extends ActionImplementationObject<infer Args, infer Result>
			? ActionAPI<Args, Result>
			: never
	}

	private pubsub: GossipSub
	private peers: PeerId[] = []
	private _connections: Connection[] = []
	public readonly connections: Connections = {}

	public status: AppConnectionStatus = "disconnected"

	private readonly log = logger("canvas:core")

	#open = true

	/**
	 * These are our current direct GossipSub peers, not just open connections.
	 * Peers are added to the set in response to a GossipSub subscription-change event,
	 * and are removed in response to a subscription-change event, or a peer:disconnect event.
	 */
	#peers = new Map<string, PeerId>()

	private constructor(
		private readonly controller: AbortController,
		private readonly runtime: Runtime,

		public readonly signers: SessionSigner[],
		public readonly libp2p: Libp2p<ServiceMap>,
		public readonly messageLog: AbstractGossipLog<Action | Session, void | any>,
	) {
		super()
		this.db = runtime.db

		assert(libp2p.services.pubsub !== undefined, "pubsub service not found")
		assert(libp2p.services.pubsub instanceof GossipSub, "expected pubsub instanceof GossipSub")
		this.pubsub = libp2p.services.pubsub

		this.log("using peerId %p", libp2p.peerId)

		this.libp2p.addEventListener("peer:connect", this.handlePeerConnect)
		this.libp2p.addEventListener("peer:disconnect", this.handlePeerDisconnect)
		this.libp2p.addEventListener("connection:open", this.handleConnectionOpen)
		this.libp2p.addEventListener("connection:close", this.handleConnectionClose)
		this.pubsub.addEventListener("subscription-change", this.handleSubscriptionChange)

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))

		for (const name of runtime.actionNames) {
			const action: ActionAPI = async (args: any, options: ActionOptions = {}) => {
				const signer = options.signer ?? signers[0]
				assert(signer !== undefined, "signer not found")

				const timestamp = Date.now()

				const session = await signer.getSession(this.topic, { timestamp })

				const { address, publicKey: public_key } = session

				// Check if the session has already been added to the message log
				const results = await runtime.db.query("$sessions", {
					where: { address, public_key, expiration: { gt: timestamp } },
					limit: 1,
				})

				this.log("got %d matching sessions: %o", results.length, results)
				if (results.length === 0) {
					const { id: sessionId } = await this.append(session, { signer })
					this.log("created session %s", sessionId)
				} else {
					try {
						const row = results[0]
						const signature = cbor.decode<Signature>(hexToBytes(row.rawSignature as string))
						const message = cbor.decode<Message<Session>>(hexToBytes(row.rawMessage as string))
						this.insert(signature, message)
					} catch (err) {
						this.log("failed to rebroadcast session for action")
					}
				}

				const argsTransformer = runtime.argsTransformers[name]
				assert(argsTransformer !== undefined, "invalid action name")

				const representation = argsTransformer.toRepresentation(args)
				assert(representation !== undefined, "action args did not validate the provided schema type")

				const { id, result, recipients } = await this.append(
					{ type: "action", address, name, args: representation, blockhash: null, timestamp },
					{ signer },
				)

				this.log("applied action %s and got result %o", id, result)

				return { id, result, recipients }
			}

			Object.assign(this.actions, { [name]: action })
		}
	}

	private handlePeerConnect = ({ detail: peerId }: Libp2pEvents["peer:connect"]) => {
		this.log("peer:connect %p", peerId)
	}

	private handlePeerDisconnect = ({ detail: peerId }: Libp2pEvents["peer:disconnect"]) => {
		this.log("peer:disconnect %p", peerId)

		if (this.#peers.delete(peerId.toString())) {
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId } }))
		}
	}

	private handleConnectionOpen = ({ detail: connection }: Libp2pEvents["connection:open"]) => {
		this.log("connection:open %s %p %a", connection.id, connection.remotePeer, connection.remoteAddr)

		this._connections = [...this._connections, connection]
		const remotePeerId = connection.remotePeer.toString()
		if (!this.connections[remotePeerId]) {
			const peer = this.peers.find((peer) => peer.toString() === remotePeerId)
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
	}

	private handleConnectionClose = ({ detail: connection }: Libp2pEvents["connection:close"]) => {
		this.log("connection:close %s %p %a", connection.id, connection.remotePeer, connection.remoteAddr)
	}

	private handleSubscriptionChange = ({
		detail: { peerId, subscriptions },
	}: GossipsubEvents["subscription-change"]) => {
		const topic = GossipLogService.topicPrefix + this.topic
		const subscription = subscriptions.find((subscription) => subscription.topic === topic)
		if (subscription === undefined) {
			return
		}

		const id = peerId.toString()
		if (subscription.subscribe) {
			if (this.#peers.get(id) === undefined) {
				this.#peers.set(id, peerId)
				this.dispatchEvent(new CustomEvent("connect", { detail: { peerId } }))
			}
		} else {
			if (this.#peers.delete(id)) {
				this.dispatchEvent(new CustomEvent("disconnect", { detail: { peerId } }))
			}
		}
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

			this.libp2p.removeEventListener("peer:connect", this.handlePeerConnect)
			this.libp2p.removeEventListener("peer:disconnect", this.handlePeerDisconnect)
			this.libp2p.removeEventListener("connection:open", this.handleConnectionOpen)
			this.libp2p.removeEventListener("connection:close", this.handleConnectionClose)
			this.pubsub.removeEventListener("subscription-change", this.handleSubscriptionChange)

			this.#peers.forEach((peerId) => this.dispatchEvent(new CustomEvent("disconnect", { detail: { peerId } })))
			this.#peers.clear()

			await this.libp2p.services.gossiplog.unsubscribe(this.topic)
			await this.messageLog.close()
			await this.runtime.close()

			this.controller.abort()

			this.dispatchEvent(new Event("close"))
			this.log("closed")
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
	 * Append a new message to the end of the log (ie an action generated locally)
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async append(
		payload: Session | Action,
		options: { signer?: Signer<Message<Session | Action>> },
	): Promise<{ id: string; result: void | any; recipients: Promise<PeerId[]> }> {
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
}
