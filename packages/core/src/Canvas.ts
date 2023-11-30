import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interface/events"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import { Action, Session, Message, Signer, SessionSigner, Heartbeat } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Signature } from "@canvas-js/signed-cid"
import { AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import type { ServiceMap } from "./targets/interface.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { validatePayload } from "./schema.js"
import { assert } from "./utils.js"
import { HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT, minute, second } from "./constants.js"

export interface CanvasConfig<T extends Contract = Contract> {
	contract: string | T

	/** data directory path (NodeJS only) */
	path?: string | null
	signers?: SessionSigner[]

	// libp2p options
	offline?: boolean
	start?: boolean
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number
	discoveryTopic?: string

	/** set to `false` to disable history indexing and db.get(..) within actions */
	indexHistory?: boolean
	runtimeMemoryLimit?: number
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any, Result = any> = (
	args: Args,
	options?: ActionOptions,
) => Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }>

export interface CanvasEvents extends GossipLogEvents<Action | Session | Heartbeat, unknown> {
	close: Event

	connect: CustomEvent<{ peer: PeerId }>
	disconnect: CustomEvent<{ peer: PeerId }>

	join: CustomEvent<{ address: string }>
	leave: CustomEvent<{ address: string }>
}

export type CanvasLogEvent = CustomEvent<{
	id: string
	signature: unknown
	message: Message<Action | Session | Heartbeat>
	result: unknown
}>

export type ApplicationData = {
	peerId: string
	topic: string
	models: Record<string, Model>
	actions: string[]
}

export class Canvas<T extends Contract = Contract> extends EventEmitter<CanvasEvents> {
	public static async initialize<T extends Contract>(config: CanvasConfig<T>): Promise<Canvas<T>> {
		const { path = null, contract, signers = [], runtimeMemoryLimit, offline = false, indexHistory = true } = config

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const runtime = await createRuntime(path, signers, contract, { runtimeMemoryLimit })

		const peerId = await target.getPeerId({ topic: runtime.topic, path })
		let libp2p: Libp2p<ServiceMap> | null = null
		if (!offline) {
			libp2p = await target.createLibp2p(peerId, config)
		}

		const gossipLog = await target.openGossipLog<Action | Session | Heartbeat, void | any>(
			{ path, topic: runtime.topic },
			{
				topic: runtime.topic,
				apply: runtime.getConsumer(),
				validate: validatePayload,
				indexAncestors: indexHistory,
			},
		)

		await libp2p?.services.gossiplog.subscribe(gossipLog)

		return new Canvas(signers, peerId, libp2p, gossipLog, runtime)
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof T["actions"]]: T["actions"][K] extends ActionImplementationFunction<infer Args, infer Result>
			? ActionAPI<Args, Result>
			: T["actions"][K] extends ActionImplementationObject<infer Args, infer Result>
			? ActionAPI<Args, Result>
			: never
	}

	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")
	private readonly presenceCache = new Map<string, number>()

	#open = true
	#heartbeat: NodeJS.Timeout | null = null
	#mostRecentSigner: SessionSigner | null = null

	private constructor(
		public readonly signers: SessionSigner[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly messageLog: AbstractGossipLog<Action | Session | Heartbeat, void | any>,
		private readonly runtime: Runtime,
	) {
		super()
		this.db = runtime.db

		this.log("initialized with peerId %p", peerId)

		this.libp2p?.addEventListener("peer:discovery", ({ detail: { id, multiaddrs, protocols } }) => {
			this.log("discovered peer %p at %o with protocols %o", id, multiaddrs, protocols)
		})

		this.libp2p?.addEventListener("peer:connect", ({ detail: peerId }) => {
			this.log("connected to %p", peerId)
			this.dispatchEvent(new CustomEvent("connect", { detail: { peer: peerId.toString() } }))
		})

		this.libp2p?.addEventListener("peer:disconnect", ({ detail: peerId }) => {
			this.log("disconnected %p", peerId)
			this.dispatchEvent(new CustomEvent("disconnect", { detail: { peer: peerId.toString() } }))
		})

		this.messageLog.addEventListener("message", (event) => {
			if (event.detail.message.payload.type === "heartbeat") {
				const { address } = event.detail.message.payload
				if (!this.presenceCache.has(address)) {
					this.dispatchEvent(new CustomEvent("join", { detail: { address } }))
				}

				this.presenceCache.set(address, performance.now())
			}

			this.safeDispatchEvent("message", event)
		})

		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))

		for (const name of runtime.actionNames) {
			const action: ActionAPI = async (args: any, options: ActionOptions = {}) => {
				const signer = options.signer ?? signers[0]
				assert(signer !== undefined, "signer not found")
				this.#mostRecentSigner = signer

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

	public get topic(): string {
		return this.messageLog.topic
	}

	public async start() {
		if (this.libp2p !== null) {
			await this.libp2p.start()
			this.#heartbeat = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL)
		}
	}

	public async stop() {
		if (this.#heartbeat !== null) {
			clearInterval(this.#heartbeat)
		}

		await this.libp2p?.stop()
	}

	public async close() {
		if (this.#open) {
			this.#open = false
			this.controller.abort()
			await this.libp2p?.stop()
			await this.messageLog.close()
			await this.runtime.close()
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
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async insert(signature: Signature, message: Message<Session | Action | Heartbeat>): Promise<{ id: string }> {
		assert(message.topic === this.topic, "invalid message topic")
		if (this.libp2p === null) {
			return this.messageLog.insert(signature, message)
		} else {
			const { id } = await this.libp2p.services.gossiplog.insert(signature, message)
			return { id }
		}
	}

	/**
	 * Low-level utility method for internal and debugging use.
	 * The normal way to apply actions is to use the `Canvas.actions[name](...)` functions.
	 */
	public async append(
		payload: Session | Action,
		options: { signer?: Signer<Message<Session | Action | Heartbeat>> },
	): Promise<{ id: string; result: void | any; recipients: Promise<PeerId[]> }> {
		if (this.libp2p === null) {
			const { id, result } = await this.messageLog.append(payload, options)
			return { id, result, recipients: Promise.resolve([]) }
		} else {
			return this.libp2p.services.gossiplog.append(this.topic, payload, options)
		}
	}

	public async getMessage(
		id: string,
	): Promise<[signature: Signature, message: Message<Action | Session | Heartbeat>] | [null, null]> {
		return await this.messageLog.get(id)
	}

	public async *getMessages(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<[id: string, signature: Signature, message: Message<Action | Session | Heartbeat>]> {
		yield* this.messageLog.iterate(lowerBound, upperBound, options)
	}

	private async heartbeat() {
		if (this.libp2p === null) {
			return
		}

		// Remove stale peers
		const expiration = performance.now() - HEARTBEAT_TIMEOUT
		for (const [address, timestamp] of this.presenceCache) {
			if (timestamp < expiration) {
				this.log("removing %s from presence cache")
				this.presenceCache.delete(address)
				this.dispatchEvent(new CustomEvent("leave", { detail: { address } }))
			}
		}

		const signer = this.#mostRecentSigner ?? this.signers[0]
		const timestamp = Date.now()

		let address: string
		try {
			const session = await signer.getSession(this.topic, { timestamp, fromCache: true })
			address = session.address
		} catch (err) {
			this.log("no session, skipping heartbeat broadcast")
			return
		}

		const { id, recipients } = await this.libp2p.services.gossiplog.broadcast<Heartbeat, void>(
			this.topic,
			{ type: "heartbeat", address, timestamp, data: {} },
			{ signer },
		)
	}
}
