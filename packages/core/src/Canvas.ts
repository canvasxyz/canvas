import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interface/events"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import { Action, Session, Message, Signer, SessionSigner } from "@canvas-js/interfaces"
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

	/** set to `false` to disable history indexing and db.get(..) within actions */
	indexHistory?: boolean
	runtimeMemoryLimit?: number
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any, Result = any> = (
	args: Args,
	options?: ActionOptions
) => Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }>

export interface CanvasEvents extends GossipLogEvents<Action | Session, unknown> {
	close: Event
	connect: CustomEvent<{ peer: PeerId }>
	disconnect: CustomEvent<{ peer: PeerId }>
}

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

		const gossipLog = await target.openGossipLog<Action | Session, void | any>(
			{ path, topic: runtime.topic },
			{
				topic: runtime.topic,
				apply: runtime.getConsumer(),
				validate: validatePayload,
				indexAncestors: indexHistory,
			}
		)

		await libp2p?.services.gossiplog.subscribe(gossipLog, {})

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

	#open = true

	private constructor(
		public readonly signers: SessionSigner[],
		public readonly peerId: PeerId,
		public readonly libp2p: Libp2p<ServiceMap> | null,
		public readonly messageLog: AbstractGossipLog<Action | Session, void | any>,
		private readonly runtime: Runtime
	) {
		super()
		this.db = runtime.db

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

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))

		for (const name of runtime.actionNames) {
			// @ts-ignore
			this.actions[name] = async (args: any, options: ActionOptions = {}) => {
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
				}

				const argsTransformer = runtime.argsTransformers[name]
				assert(argsTransformer !== undefined, "invalid action name")

				const representation = argsTransformer.toRepresentation(args)
				assert(representation !== undefined, "action args did not validate the provided schema type")

				const { id, result, recipients } = await this.append(
					{ type: "action", address, name, args: representation, blockhash: null, timestamp },
					{ signer }
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
	public async insert(signature: Signature, message: Message<Session | Action>): Promise<{ id: string }> {
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
		options: { signer?: Signer<Message<Session | Action>> }
	): Promise<{ id: string; result: void | any; recipients: Promise<PeerId[]> }> {
		if (this.libp2p === null) {
			const { id, result } = await this.messageLog.append(payload, options)
			return { id, result, recipients: Promise.resolve([]) }
		} else {
			return this.libp2p.services.gossiplog.append(this.topic, payload, options)
		}
	}

	public async getMessage(
		id: string
	): Promise<[signature: Signature, message: Message<Action | Session>] | [null, null]> {
		return await this.messageLog.get(id)
	}

	public async *getMessages(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[id: string, signature: Signature, message: Message<Action | Session>]> {
		yield* this.messageLog.iterate(lowerBound, upperBound, options)
	}
}
