import { Libp2p, PeerId, TypedEventEmitter, CustomEvent } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import { sha256 } from "@noble/hashes/sha2"
import { bytesToHex, randomBytes } from "@noble/hashes/utils"

import type pg from "pg"

import { Signature, Action, Session, Message, SessionSigner, SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, Model } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractGossipLog, GossipLogEvents, NetworkConfig, ServiceMap } from "@canvas-js/gossiplog"
import { assert } from "@canvas-js/utils"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { validatePayload } from "./schema.js"
import { AbstractRuntime } from "./runtime/AbstractRuntime.js"

export type { Model } from "@canvas-js/modeldb"
export type { PeerId } from "@libp2p/interface"

export interface CanvasConfig<T extends Contract = Contract> extends NetworkConfig {
	topic: string
	contract: string | T
	signers?: SessionSigner[]

	/** data directory path (NodeJS/sqlite), or postgres connection config (NodeJS/pg) */
	path?: string | pg.ConnectionConfig | null

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
	public static async initialize<T extends Contract>(config: CanvasConfig<T>): Promise<Canvas<T>> {
		const { path = null, contract, signers: initSigners = [], runtimeMemoryLimit } = config

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

		const runtime = await createRuntime(path, topic, signers, contract, { runtimeMemoryLimit })
		const messageLog = await target.openGossipLog(
			{ topic, path },
			{
				topic: topic,
				apply: runtime.getConsumer(),
				validatePayload: validatePayload,
				verifySignature: verifySignature,
				schema: runtime.schema,
			},
		)

		runtime.db = messageLog.db

		const libp2p = await target.createLibp2p(config)
		if (libp2p.status === "started") {
			await messageLog.listen(libp2p)
		} else {
			libp2p.addEventListener("start", () => messageLog.listen(libp2p), { once: true })
		}

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
			this.log(
				"discovered peer %p with addresses %o",
				id,
				multiaddrs.map((addr) => addr.toString()),
			)
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
				this.log("executing action %s %o", name, args)
				const timestamp = Date.now()

				const sessionSigner = options.signer ?? signers.getFirst()
				assert(sessionSigner !== undefined, "signer not found")

				this.log("using session signer %s", sessionSigner.key)
				let session = await sessionSigner.getSession(this.topic)

				// check that a session for the delegate signer exists in the log and hasn't expired
				if (session === null) {
					this.log("no session found")
				} else {
					this.log("got session for public key %s", session.payload.publicKey)

					const sessionIds = await this.getSessions({
						did: session.payload.did,
						publicKey: session.signer.publicKey,
						minExpiration: timestamp,
					})

					if (sessionIds.length === 0) {
						this.log("the session was lost or has expired")
						session = null
					}
				}

				// if the delegate signer doesn't exist, or if the session expired,
				// create and append a new one
				if (session === null) {
					this.log("creating a new session topic %s with signer %s", this.topic, sessionSigner.key)
					session = await sessionSigner.newSession(this.topic)
					await this.messageLog.append(session.payload, { signer: session.signer })
				}

				const argsTransformer = runtime.argsTransformers[name]
				assert(argsTransformer !== undefined, "invalid action name")

				const argsRepresentation = argsTransformer.toRepresentation(args)
				assert(argsRepresentation !== undefined, "action args did not validate the provided schema type")

				const { id, signature, message, recipients } = await this.messageLog.append<Action>(
					{
						type: "action",
						did: session.payload.did,
						name,
						args: argsRepresentation,
						context: { timestamp },
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
		did: string
		publicKey: string
		minExpiration?: number
	}): Promise<{ id: string; did: string; publicKey: string; expiration: number | null }[]> {
		this.log(
			"get sessions for did %s and public key %s with min expiration %d",
			query.did,
			query.publicKey,
			query.minExpiration ?? Infinity,
		)

		const sessions = await this.db.query<{
			message_id: string
			public_key: string
			did: string
			expiration: number | null
		}>("$sessions", {
			select: { message_id: true, public_key: true, did: true, expiration: true },
			where: { public_key: query.publicKey, did: query.did },
		})

		return sessions
			.filter(({ expiration }) => (expiration ?? Infinity) >= (query.minExpiration ?? 0))
			.map((record) => ({
				id: record.message_id,
				publicKey: record.public_key,
				did: record.did,
				expiration: record.expiration,
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
		return await this.messageLog.insert({ signature, message })
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
		// yield* this.messageLog.iterate(lowerBound, upperBound, options)
		const range: { lt?: string; lte?: string; gt?: string; gte?: string; reverse?: boolean; limit?: number } = {}
		if (lowerBound) {
			if (lowerBound.inclusive) range.gte = lowerBound.id
			else range.gt = lowerBound.id
		}
		if (upperBound) {
			if (upperBound.inclusive) range.lte = upperBound.id
			else range.lt = upperBound.id
		}
		if (options.reverse) {
			range.reverse = true
		}
		return this.messageLog.iterate(range)
	}

	/**
	 * Get an existing session
	 */
	public async getSession(query: { address: string; publicKey: string; timestamp?: number }): Promise<string | null> {
		// TODO: change address to did (note that network explorer uses this)
		const sessions = await this.db.query<{ message_id: string }>("$sessions", {
			select: { message_id: true },
			orderBy: { message_id: "desc" },
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
