import { Libp2p, TypedEventEmitter } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import type pg from "pg"
import type { SqlStorage } from "@cloudflare/workers-types"
import { bytesToHex } from "@noble/hashes/utils"

import { Signature, Action, Message, Snapshot, SessionSigner, SignerCache, MessageType } from "@canvas-js/interfaces"
import { AbstractModelDB, Model, ModelSchema, Effect } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { AbstractGossipLog, GossipLogEvents, NetworkClient, SignedMessage } from "@canvas-js/gossiplog"
import type { ServiceMap, NetworkConfig } from "@canvas-js/gossiplog/libp2p"

import { assert, mapValues } from "@canvas-js/utils"

import target from "#target"

import type { Contract, Actions, ActionImplementation, ModelAPI, DeriveModelTypes } from "./types.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { AbstractRuntime, ActionRecord } from "./runtime/AbstractRuntime.js"
import { validatePayload } from "./schema.js"
import { createSnapshot, hashSnapshot, Change } from "./snapshot.js"
import { initialUpgradeSchema, topicPattern } from "./utils.js"

export type { Model } from "@canvas-js/modeldb"
export type { PeerId } from "@libp2p/interface"

export type Config<ModelsT extends ModelSchema = any, ActionsT extends Actions<ModelsT> = Actions<ModelsT>> = {
	topic: string
	contract: string | Contract<ModelsT, ActionsT>
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

export type ActionAPI<Args extends Array<any> = any, Result = any> = (
	...args: Args
) => Promise<SignedMessage<Action, Result> & { result: Result }>

export interface CanvasEvents extends GossipLogEvents<MessageType> {
	stop: Event
}

export type CanvasLogEvent = CustomEvent<SignedMessage<MessageType>>

export type ApplicationData = {
	peerId: string | null
	connections: Record<string, { status: string; direction: string; rtt: number | undefined }>
	networkConfig: {
		bootstrapList?: string[]
		listen?: string[]
		announce?: string[]
	}
	wsConfig: {
		listen?: number
		connect?: string
	}
	root: string | null
	heads: string[]
	database: string
	topic: string
	models: Record<string, Model>
	actions: string[]
}

export class Canvas<
	ModelsT extends ModelSchema = ModelSchema,
	ActionsT extends Actions<ModelsT> = Actions<ModelsT>,
> extends TypedEventEmitter<CanvasEvents> {
	public static namespace = "canvas"
	public static version = 3

	public static async initialize<ModelsT extends ModelSchema, ActionsT extends Actions<ModelsT> = Actions<ModelsT>>(
		config: Config<ModelsT, ActionsT>,
	): Promise<Canvas<ModelsT, ActionsT>> {
		const { topic, path = null, contract, signers: initSigners = [], runtimeMemoryLimit } = config

		assert(topicPattern.test(topic), "invalid topic (must match [a-zA-Z0-9\\.\\-])")

		const signers = new SignerCache(initSigners.length === 0 ? [new SIWESigner()] : initSigners)

		const verifySignature = (signature: Signature, message: Message<MessageType>) => {
			const signer = signers.getAll().find((signer) => signer.scheme.codecs.includes(signature.codec))
			assert(signer !== undefined, "no matching signer found")
			return signer.scheme.verify(signature, message)
		}

		const runtime = await createRuntime(topic, signers, contract, { runtimeMemoryLimit })
		const gossipTopic = config.snapshot ? `${topic}#${hashSnapshot(config.snapshot)}` : topic // topic for peering

		const messageLog = await target.openGossipLog(
			{ topic: gossipTopic, path, clear: config.reset },
			{
				topic, // topic for signing and execution, in runtime consumer
				apply: runtime.getConsumer(),
				validatePayload: validatePayload,
				verifySignature: verifySignature,
				schema: { ...config.schema, ...runtime.schema },

				version: { [Canvas.namespace]: Canvas.version },

				initialUpgradeSchema: { ...runtime.models, ...initialUpgradeSchema },
				initialUpgradeVersion: { [Canvas.namespace]: 1 },

				async upgrade(upgradeAPI, oldConfig, oldVersion, newVersion) {
					const log = logger("canvas:core:upgrade")
					const version = oldVersion[Canvas.namespace] ?? 0
					log("found canvas version %d", version)

					let replayRequired = false

					if (version <= 1) {
						log("removing property 'branch' from $effects", version)
						await upgradeAPI.removeProperty("$effects", "branch")
					}

					if (version <= 2) {
						for (const [modelName, modelInit] of Object.entries(AbstractRuntime.effectsModel)) {
							log("creating model %s", modelName)
							await upgradeAPI.createModel(modelName, modelInit)
						}

						log("deleting model %s", "$effects")
						await upgradeAPI.deleteModel("$effects")

						replayRequired = true
					}

					if (replayRequired) {
						for (const name of Object.keys(runtime.models)) {
							await upgradeAPI.clear(name)
						}
					}

					return replayRequired
				},
			},
		)

		for (const model of Object.values(messageLog.db.models)) {
			if (model.name.startsWith("$")) {
				continue
			}

			const primaryProperties = messageLog.db.config.primaryKeys[model.name]
			if (primaryProperties.length !== 1) {
				throw new Error("contract models cannot use composite primary keys")
			} else if (primaryProperties[0].type !== "string") {
				throw new Error("contract models must have a string primary key")
			}
		}

		if (config.reset) {
			for (const modelName of Object.keys({ ...config.schema, ...runtime.schema, ...AbstractGossipLog.schema })) {
				await messageLog.db.clear(modelName)
			}
		}

		if (config.snapshot) {
			const [clock, heads] = await messageLog.getClock()
			if (clock === 1 && heads.length === 0) {
				await messageLog.append(config.snapshot)
			}
		}

		const app = new Canvas<ModelsT, ActionsT>(signers, messageLog, runtime)

		// Check to see if the $actions table is empty and populate it if necessary
		const messagesCount = await messageLog.db.count("$messages")
		// const sessionsCount = await db.count("$sessions")
		const actionsCount = await messageLog.db.count("$actions")
		const usersCount = await messageLog.db.count("$dids")
		if (messagesCount > 0 && (actionsCount === 0 || usersCount === 0)) {
			app.log("indexing $actions and $dids table")
			const limit = 4096
			let resultCount: number
			let start: string | undefined = undefined
			do {
				const results: { id: string; message: Message<MessageType> }[] = await messageLog.db.query<{
					id: string
					message: Message<MessageType>
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
					await messageLog.db.apply(effects)
				}
			} while (resultCount > 0)
		}

		app.addEventListener("message", (event) => {
			const message = event.detail
			if (message.message.payload.type !== "action") {
				return
			}
		})

		return app
	}

	public static async buildContract(contract: string, config?: Record<string, string>) {
		return await target.buildContract(contract, config)
	}

	public static async buildContractByLocation(location: string) {
		return await target.buildContractByLocation(location)
	}

	public readonly db: AbstractModelDB
	public readonly actions = {} as {
		[K in keyof ActionsT]: ActionsT[K] extends ActionImplementation<ModelsT, infer Args, infer Result>
			? ActionAPI<Args, Result>
			: never
	}
	public readonly as: (signer: SessionSigner<any>) => {
		[K in keyof ActionsT]: ActionsT[K] extends ActionImplementation<ModelsT, infer Args, infer Result>
			? ActionAPI<Args, Result>
			: never
	}
	private readonly controller = new AbortController()
	private readonly log = logger("canvas:core")

	private peerId: string | null = null
	private libp2p: Libp2p | null = null
	private networkConfig: NetworkConfig | null = null
	private wsListen: { port: number } | null = null
	private wsConnect: { url: string } | null = null

	private constructor(
		public readonly signers: SignerCache,
		public readonly messageLog: AbstractGossipLog<MessageType>,
		private readonly runtime: Runtime,
	) {
		super()
		this.db = messageLog.db

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))
		this.messageLog.addEventListener("connect", (event) => this.safeDispatchEvent("connect", event))
		this.messageLog.addEventListener("disconnect", (event) => this.safeDispatchEvent("disconnect", event))

		const actionCache = {} as {
			[K in keyof ActionsT]: (signer: SessionSigner<any>, db: ModelAPI<DeriveModelTypes<ModelsT>>, ...args: any) => any
		}

		for (const name of runtime.actionNames) {
			const action = async (signer: SessionSigner<any> | null, ...args: any) => {
				this.log("executing action %s %o", name, args)

				const sessionSigner = signer ?? signers.getFirst()
				assert(sessionSigner !== undefined, "signer not found")

				const timestamp = sessionSigner.getCurrentTimestamp()

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

				const signedMessage = await this.messageLog.append<Action>(
					{ type: "action", did: session.payload.did, name, args: args ?? null, context: { timestamp } },
					{ signer: session.signer },
				)

				this.log("applied action %s", signedMessage.id)

				return signedMessage
			}

			Object.assign(actionCache, { [name]: action })
			Object.assign(this.actions, { [name]: action.bind(this, null) })
		}

		this.as = (signer: SessionSigner<any>) => {
			return mapValues(actionCache, (action) => action.bind(this, signer)) as {
				[K in keyof ActionsT]: ActionsT[K] extends ActionImplementation<ModelsT, infer Args, infer Result>
					? ActionAPI<Args, Result>
					: never
			}
		}
	}

	public async replay(): Promise<boolean> {
		for (const name of Object.keys(this.db.models)) {
			if (!name.startsWith("$")) {
				this.log("clearing model %s", name)
				await this.messageLog.db.clear(name)
			}
		}

		return await this.messageLog.replay()
	}

	public async connect(url: string, options: { signal?: AbortSignal } = {}): Promise<NetworkClient<any>> {
		this.wsConnect = { url }
		return await this.messageLog.connect(url, options)
	}

	public async listen(port: number, options: { signal?: AbortSignal } = {}): Promise<void> {
		this.wsListen = { port }
		await target.listen(this, port, options)
	}

	public async startLibp2p(config: NetworkConfig): Promise<Libp2p<ServiceMap<MessageType>>> {
		const libp2p = await this.messageLog.startLibp2p(config)
		this.libp2p = libp2p
		this.networkConfig = config
		return libp2p
	}

	public getContract() {
		return this.runtime.contract
	}

	public getSchema(internal?: false) {
		if (internal) {
			return this.runtime.schema
		} else {
			const entries = Object.entries(this.runtime.schema).filter(([t]) => !t.startsWith("$"))
			return Object.fromEntries(entries)
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

	public get topic(): string {
		return this.messageLog.topic
	}

	public async stop() {
		this.controller.abort()
		await this.messageLog.close()

		// Close the runtime. If we didn't manage ContractRuntime's QuickJS lifetimes correctly, it's possible
		// this could result in an exception, which we shouldn't propagate, so we don't crash the CLI or app harness.
		try {
			await this.runtime.close()
		} catch (err) {
			console.error(err)
		}

		this.log("stopped")
		this.dispatchEvent(new Event("stop"))
	}

	public async getApplicationData(): Promise<ApplicationData> {
		const models = Object.fromEntries(Object.entries(this.db.models).filter(([name]) => !name.startsWith("$")))
		const root = await this.messageLog.tree.read((txn) => txn.getRoot())
		const heads = await this.db.query<{ id: string }>("$heads").then((records) => records.map((record) => record.id))

		const connections: Record<string, { status: string; direction: string; rtt: number | undefined }> = {}
		for (const conn of this.libp2p?.getConnections() ?? []) {
			const addr = conn.remoteAddr.toString()
			connections[addr] = { status: conn.status, direction: conn.direction, rtt: conn.rtt }
		}

		return {
			connections,
			peerId: this.libp2p ? this.libp2p.peerId.toString() : null,
			networkConfig: {
				bootstrapList: this.networkConfig?.bootstrapList,
				listen: this.networkConfig?.listen,
				announce: this.networkConfig?.announce,
			},
			wsConfig: {
				connect: this.wsConnect?.url,
				listen: this.wsListen?.port,
			},
			root: root ? `${root.level}:${bytesToHex(root.hash)}` : null,
			heads,
			database: this.db.getType(),
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
	public async insert(signature: Signature, message: Message<MessageType>): Promise<{ id: string }> {
		assert(message.topic === this.topic, "invalid message topic")

		const signedMessage = this.messageLog.encode(signature, message)
		await this.messageLog.insert(signedMessage)
		return { id: signedMessage.id }
	}

	public async getMessage(id: string): Promise<SignedMessage<MessageType> | null> {
		return await this.messageLog.get(id)
	}

	public async *getMessages(
		lowerBound: { id: string; inclusive: boolean } | null = null,
		upperBound: { id: string; inclusive: boolean } | null = null,
		options: { reverse?: boolean } = {},
	): AsyncIterable<SignedMessage<MessageType>> {
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

	public async createSnapshot(changesets?: Change[]): Promise<Snapshot> {
		return createSnapshot(this, changesets)
	}
}
