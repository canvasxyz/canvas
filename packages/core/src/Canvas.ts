import { PeerId } from "@libp2p/interface-peer-id"
import { EventEmitter, CustomEvent } from "@libp2p/interface/events"
import { Libp2p } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import { Action, Session, Message, MessageSigner, SessionSigner, CBORValue } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Signature } from "@canvas-js/signed-cid"
import { AbstractGossipLog, GossipLogEvents } from "@canvas-js/gossiplog"

import target from "#target"

import {
	Runtime,
	createRuntime,
	InlineContract,
	ActionImplementationFunction,
	ActionImplementationObject,
} from "./runtime/index.js"
import { ServiceMap } from "./targets/interface.js"
import { validatePayload } from "./schema.js"
import { assert } from "./utils.js"

export interface CanvasConfig<Contract extends InlineContract = InlineContract> {
	topic: string
	contract: string | Contract

	/**
	 * Defaults to the topic.
	 * - NodeJS: data directory path
	 * - browser: IndexedDB database namespace
	 */
	location?: string | null

	signers?: SessionSigner[]
	replay?: boolean
	runtimeMemoryLimit?: number

	// libp2p options
	offline?: boolean
	start?: boolean
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
	minConnections?: number
	maxConnections?: number

	/** set to `false` to disable history indexing and db.get(..) */
	indexHistory?: boolean
}

export type ActionOptions = { chain?: string; signer?: SessionSigner }

export type ActionAPI<Args = any, Result = any> = (
	args: Args,
	options?: ActionOptions
) => Promise<{ id: string; result: Result; recipients: Promise<PeerId[]> }>

export interface CoreEvents extends GossipLogEvents<Action | Session, unknown> {
	close: Event
	connect: CustomEvent<{ peer: PeerId }>
	disconnect: CustomEvent<{ peer: PeerId }>
}

export type ApplicationData = {
	peerId: string
	models: Record<string, Model>
	topics: Record<string, { actions: string[] | null }>
}

export class Canvas<Contract extends InlineContract = InlineContract> extends EventEmitter<CoreEvents> {
	public static async initialize<Contract extends InlineContract>(
		config: CanvasConfig<Contract>
	): Promise<Canvas<Contract>> {
		const {
			topic,
			location = topic,
			contract,
			signers = [],
			runtimeMemoryLimit,
			replay = false,
			offline = false,
			indexHistory = true,
		} = config

		if (signers.length === 0) {
			signers.push(new SIWESigner())
		}

		const runtime = await createRuntime(location, signers, contract, { runtimeMemoryLimit })

		const peerId = await target.getPeerId(location)
		let libp2p: Libp2p<ServiceMap> | null = null
		if (!offline) {
			libp2p = await target.createLibp2p(peerId, config)
		}

		const gossipLog = await target.openGossipLog<Action | Session, void | CBORValue>(location, {
			topic: topic,
			apply: runtime.getConsumer(),
			replay: replay,
			validate: validatePayload,
			indexAncestors: indexHistory,
		})

		await libp2p?.services.gossiplog.subscribe(gossipLog, {})

		return new Canvas(signers, peerId, libp2p, gossipLog, runtime)
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof Contract["actions"]]: Contract["actions"][K] extends ActionImplementationFunction<
			infer Args,
			infer Result
		>
			? ActionAPI<Args, Result>
			: Contract["actions"][K] extends ActionImplementationObject<infer Args, infer Result>
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
		public readonly messageLog: AbstractGossipLog<Action | Session, CBORValue | void>,
		private readonly runtime: Runtime
	) {
		super()
		this.db = runtime.db

		libp2p?.addEventListener("peer:discovery", ({ detail: { id, multiaddrs, protocols } }) => {
			this.log("discovered peer %p at %o with protocols %o", id, multiaddrs, protocols)
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
			// @ts-ignore
			this.actions[name] = async (args: CBORValue, options: ActionOptions = {}) => {
				const signer =
					options.signer ?? signers.find((signer) => options.chain === undefined || signer.match(options.chain))

				assert(signer !== undefined, "signer not found")

				const timestamp = Date.now()

				const session = await signer.getSession(this.topic, { timestamp, chain: options.chain })

				const { chain, address, publicKeyType: public_key_type, publicKey: public_key } = session

				// Check if the session has already been added to the message log
				const results = await runtime.db.query("$sessions", {
					where: { chain, address, public_key_type, public_key, expiration: { gt: timestamp } },
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
					{ type: "action", chain, address, name, args: representation, blockhash: null, timestamp },
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
		options: { signer?: MessageSigner<Session | Action> }
	): Promise<{ id: string; result: void | CBORValue; recipients: Promise<PeerId[]> }> {
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

	public async *getMessageStream<Payload = Action>(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {}
	): AsyncIterable<[id: string, signature: Signature, message: Message<Payload>]> {
		for await (const [id, signature, message] of this.messageLog.iterate(lowerBound, upperBound, options)) {
			yield [id, signature, message as Message<Payload>]
		}
	}
}
