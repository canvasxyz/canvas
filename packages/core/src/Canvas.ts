import { Libp2p, TypedEventEmitter } from "@libp2p/interface"
import { logger } from "@libp2p/logger"

import type pg from "pg"

import { Signature, Action, Session, Message, Snapshot, SessionSigner, SignerCache } from "@canvas-js/interfaces"
import { AbstractModelDB, Model, ModelSchema, Effect } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractGossipLog, GossipLogEvents, SignedMessage } from "@canvas-js/gossiplog"
import type { ServiceMap, NetworkConfig } from "@canvas-js/gossiplog/libp2p"
import type { SqlStorage } from "@cloudflare/workers-types"

import { assert } from "@canvas-js/utils"

import target from "#target"

import type { Contract, ActionImplementationFunction, ActionImplementationObject } from "./types.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { ActionRecord } from "./runtime/AbstractRuntime.js"
import { validatePayload } from "./schema.js"
import { createSnapshot, hashSnapshot } from "./snapshot.js"
import { topicPattern } from "./utils.js"

export type { Model } from "@canvas-js/modeldb"
export type { PeerId } from "@libp2p/interface"

export type CanvasConfig<T extends Contract = Contract> = {
	topic: string
	contract: string | T
	signers?: SessionSigner[]

	/** data directory path (NodeJS/sqlite), postgres connection config (NodeJS/pg), or storage backend (Cloudflare DO) */
	path?: string | pg.ConnectionConfig | SqlStorage | null

	/** set a memory limit for the quickjs runtime, only used if `contract` is a string */
	runtimeMemoryLimit?: number

	/** clear all models and metadata before starting */
	reset?: boolean

	/** define additional tables in the local modeldb database */
	schema?: ModelSchema

	/** provide a snapshot to initialize the runtime database with, requires `reset: true` */
	snapshot?: Snapshot | null
}

export type ActionOptions = { signer?: SessionSigner }

export type ActionAPI<Args = any> = (
	args?: Args,
	options?: ActionOptions,
) => Promise<{ id: string; signature: Signature; message: Message<Action> }>

export interface CanvasEvents extends GossipLogEvents<Action | Session | Snapshot> {
	stop: Event
}

export type CanvasLogEvent = CustomEvent<{
	id: string
	signature: unknown
	message: Message<Action | Session | Snapshot>
}>

export type ApplicationData = {
	topic: string
	models: Record<string, Model>
	actions: string[]
}

export type ContainerConfig = Omit<CanvasConfig<Contract>, "contract" | "topic"> & {
	connection: { topic: string; url: string }
	models: Contract["models"]
	actions: Contract["actions"]
	globals?: Contract["globals"]
}

function exclude<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
	const result = { ...obj }
	for (const key of keys) {
		delete result[key]
	}
	return result
}

export class Canvas<T extends Contract = Contract> extends TypedEventEmitter<CanvasEvents> {
	public static async initializeContainer<T extends Contract>(config: ContainerConfig): Promise<Canvas<T>> {
		const contract = { models: config.models, actions: config.actions, globals: config.globals } as T
		return this.initialize<T>({ topic: config.connection.topic, contract, ...exclude(config, ["models", "actions", "globals"]) })
	}

	public static async initialize<T extends Contract>(config: CanvasConfig<T>): Promise<Canvas<T>> {
		const { topic, path = null, contract, signers: initSigners = [], runtimeMemoryLimit } = config

		assert(topicPattern.test(topic), "invalid topic (must match [a-zA-Z0-9\\.\\-])")

		const signers = new SignerCache(initSigners.length === 0 ? [new SIWESigner()] : initSigners)

		const verifySignature = (signature: Signature, message: Message<Action | Session | Snapshot>) => {
			const signer = signers.getAll().find((signer) => signer.scheme.codecs.includes(signature.codec))
			assert(signer !== undefined, "no matching signer found")
			return signer.scheme.verify(signature, message)
		}

		const runtime = await createRuntime(topic, signers, contract, { runtimeMemoryLimit })
		const gossipTopic = config.snapshot ? `topic#${hashSnapshot(config.snapshot)}` : topic // topic for peering
		const messageLog = await target.openGossipLog(
			{ topic: gossipTopic, path },
			{
				topic, // topic for signing and execution, in runtime consumer
				apply: runtime.getConsumer(),
				validatePayload: validatePayload,
				verifySignature: verifySignature,
				schema: { ...config.schema, ...runtime.schema },
			},
		)

		const db = messageLog.db
		runtime.db = db

		if (config.reset) {
			for (const modelName of Object.keys({ ...config.schema, ...runtime.schema, ...AbstractGossipLog.schema })) {
				await db.clear(modelName)
			}
		}

		if (config.snapshot) {
			if (!config.reset) {
				throw new Error("snapshot must be provided with reset: true")
			}
			await messageLog.append(config.snapshot)
		}

		const app = new Canvas<T>(signers, messageLog, runtime)

		// Check to see if the $actions table is empty and populate it if necessary
		const messagesCount = await db.count("$messages")
		// const sessionsCount = await db.count("$sessions")
		const actionsCount = await db.count("$actions")
		const usersCount = await db.count("$dids")
		if (messagesCount > 0 && (actionsCount === 0 || usersCount === 0)) {
			app.log("indexing $actions and $dids table")
			const limit = 4096
			let resultCount: number
			let start: string | undefined = undefined
			do {
				const results: { id: string; message: Message<Action | Session> }[] = await db.query<{
					id: string
					message: Message<Action | Session>
				}>("$messages", {
					limit,
					select: { id: true, message: true },
					where: { id: { gt: start } },
					orderBy: { id: "asc" },
				})

				resultCount = results.length

				app.log("got page of %d messages", resultCount)

				const effects: Effect[] = []
				for (const { id, message } of results) {
					if (message.payload.type === "action") {
						const { did, name, context } = message.payload
						app.log("indexing action %s (name: %s, did: %s)", id, name, did)
						const record: ActionRecord = { message_id: id, did, name, timestamp: context.timestamp }
						effects.push({ operation: "set", model: "$actions", value: record })
					} else if (message.payload.type === "session") {
						// index user
						const { did, publicKey } = message.payload
						app.log("indexing user %s (did: %s)", publicKey, did)
						const record = { did }
						effects.push({ operation: "set", model: "$dids", value: record })
					}
					start = id
				}

				if (effects.length > 0) {
					await db.apply(effects)
				}
			} while (resultCount > 0)
		}

		return app
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
		public readonly messageLog: AbstractGossipLog<Action | Session | Snapshot>,
		private readonly runtime: Runtime,
	) {
		super()
		this.db = runtime.db

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))
		this.messageLog.addEventListener("connect", (event) => this.safeDispatchEvent("connect", event))
		this.messageLog.addEventListener("disconnect", (event) => this.safeDispatchEvent("disconnect", event))

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

				const argsRepresentation = args === undefined ? null : argsTransformer.toRepresentation(args)
				assert(argsRepresentation !== undefined, "action args did not validate the provided schema type")

				const { id, signature, message } = await this.messageLog.append<Action>(
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

				return { id, signature, message }
			}

			Object.assign(this.actions, { [name]: action })
		}
	}

	public async connect(url: string, options: { signal?: AbortSignal } = {}): Promise<void> {
		await this.messageLog.connect(url, options)
	}

	public async listen(port: number, options: { signal?: AbortSignal } = {}): Promise<void> {
		await target.listen(this, port, options)
	}

	public async startLibp2p(config: NetworkConfig): Promise<Libp2p<ServiceMap<Action | Session | Snapshot>>> {
		return await this.messageLog.startLibp2p(config)
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

	public get topic(): string {
		return this.messageLog.topic
	}

	public async stop() {
		this.controller.abort()
		await this.messageLog.close()
		await this.runtime.close()
		this.log("stopped")
		this.dispatchEvent(new Event("stop"))
	}

	public getApplicationData(): ApplicationData {
		const models = Object.fromEntries(Object.entries(this.db.models).filter(([name]) => !name.startsWith("$")))
		return {
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
	public async insert(signature: Signature, message: Message<Session | Action | Snapshot>): Promise<{ id: string }> {
		assert(message.topic === this.topic, "invalid message topic")

		const signedMessage = this.messageLog.encode(signature, message)
		await this.messageLog.insert(signedMessage)
		return { id: signedMessage.id }
	}

	public async getMessage(id: string): Promise<SignedMessage<Action | Session | Snapshot> | null> {
		return await this.messageLog.get(id)
	}

	public async *getMessages(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<SignedMessage<Action | Session | Snapshot>> {
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
	public async getSession(query: { did: string; publicKey: string }): Promise<string | null> {
		const sessions = await this.db.query<{ message_id: string }>("$sessions", {
			select: { message_id: true },
			orderBy: { message_id: "desc" },
			where: {
				public_key: query.publicKey,
				did: query.did,
			},
		})

		if (sessions.length === 0) {
			return null
		} else {
			return sessions[0].message_id
		}
	}

	public async createSnapshot(): Promise<Snapshot> {
		return createSnapshot(this)
	}
}
