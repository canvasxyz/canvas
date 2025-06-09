import { Libp2p, TypedEventEmitter } from "@libp2p/interface"
import { logger } from "@libp2p/logger"
import type { SqlStorage } from "@cloudflare/workers-types"
import * as pg from "pg"
import * as cbor from "@ipld/dag-cbor"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

import { Contract } from "@canvas-js/core/contract"
import { Signature, Action, Message, Snapshot, SessionSigner, SignerCache, MessageType } from "@canvas-js/interfaces"
import { AbstractModelDB, Model, Effect } from "@canvas-js/modeldb"
import { SIWESigner } from "@canvas-js/signer-ethereum"
import { AbstractGossipLog, GossipLogEvents, NetworkClient, SignedMessage } from "@canvas-js/gossiplog"
import type { ServiceMap, NetworkConfig } from "@canvas-js/gossiplog/libp2p"

import { assert, JSValue, mapValues } from "@canvas-js/utils"
import { SnapshotSignatureScheme } from "@canvas-js/signatures"

import target from "#target"

import type {
	ContractAction,
	ModelSchema,
	DeriveModelTypes,
	ContractClass,
	GetActionsType,
	ActionAPI,
} from "./types.js"
import { Runtime, createRuntime } from "./runtime/index.js"
import { ActionRecord } from "./runtime/AbstractRuntime.js"
import { validatePayload } from "./schema.js"
import { CreateSnapshotArgs, createSnapshot, hashSnapshot } from "./snapshot.js"
import { baseVersion, initialUpgradeSchema, initialUpgradeVersion, upgrade } from "./migrations.js"
import { namespacePattern } from "./utils.js"

export type { Model } from "@canvas-js/modeldb"
export type { PeerId } from "@libp2p/interface"

export type Config<
	ModelsT extends ModelSchema = ModelSchema,
	InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
> = {
	contract: string | { namespace?: string; models: ModelsT } | ContractClass<ModelsT, InstanceT>

	/** constructor arguments for the contract class */
	args?: JSValue[]

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

	/** override the internal GossipLog topic */
	topic?: string
}

export interface CanvasEvents extends GossipLogEvents<MessageType> {
	stop: Event
}

export type CanvasLogEvent = CustomEvent<SignedMessage<MessageType>>

/**
 * Sync state, only available on the client.
 * - Offline is the initial state.
 * - Starting means the client has a WebSocket connection, but has not received heads to sync to.
 * - In progress means the client has started a Merkle sync, but has not run to completion.
 * - Complete means a sync has run to completion. *Not* debounced. The server may new actions during a sync.
 * - Error means an error occurred during Merkle sync, and the state of the log is unknown.
 */
export type ClientSyncStatus = "offline" | "starting" | "inProgress" | "complete" | "error"

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
	signerKeys: string[]
	lastMessage: number | null
}

export class Canvas<
	ModelsT extends ModelSchema = ModelSchema,
	InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
> extends TypedEventEmitter<CanvasEvents> {
	public static namespace = "canvas"
	public static version = 4

	public static async initialize<
		ModelsT extends ModelSchema = ModelSchema,
		InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
	>(config: Config<ModelsT, InstanceT>): Promise<Canvas<ModelsT, InstanceT>> {
		const { path = null, contract, args = [], signers: initSigners = [], runtimeMemoryLimit } = config

		const argsHash = bytesToHex(sha256(cbor.encode(args)).subarray(0, 4))

		const signers = new SignerCache(initSigners.length === 0 ? [new SIWESigner({ burner: true })] : initSigners)

		const verifySignature = (signature: Signature, message: Message<MessageType>) => {
			if (message.payload.type === "snapshot") {
				SnapshotSignatureScheme.verify(signature, message)
			} else {
				const signer = signers.getAll().find((signer) => signer.scheme.codecs.includes(signature.codec))
				assert(signer !== undefined, "no matching signer found")
				assert(message.clock > 0, "invalid clock")
				return signer.scheme.verify(signature, message)
			}
		}

		const runtime = await createRuntime(contract as string | ContractClass, args, signers, { runtimeMemoryLimit })
		assert(namespacePattern.test(runtime.namespace), "invalid namespace, must match [a-zA-Z0-9\\.\\-]")

		const topicComponents = [runtime.namespace, argsHash]
		if (config.snapshot) {
			topicComponents.push(hashSnapshot(config.snapshot))
		}

		const topic = config.topic ?? topicComponents.join(":")

		const messageLog = await target.openGossipLog(
			{ topic: topic, path },
			{
				topic: topic,
				apply: runtime.getConsumer(),

				validatePayload: validatePayload,
				verifySignature: verifySignature,
				schema: { ...config.schema, ...runtime.schema },
				clear: config.reset,

				version: baseVersion,
				initialUpgradeSchema: { ...runtime.models, ...initialUpgradeSchema },
				initialUpgradeVersion: initialUpgradeVersion,
				upgrade: async (upgradeAPI, oldConfig, oldVersion, newVersion) => {
					const replayRequired = await upgrade(upgradeAPI, oldConfig, oldVersion, newVersion)
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

		const app = new Canvas<ModelsT, InstanceT>(signers, messageLog, runtime)

		if (config.snapshot) {
			const message: Message<Snapshot> = {
				topic: topic,
				clock: 0,
				parents: [],
				payload: config.snapshot,
			}

			const signature = SnapshotSignatureScheme.create().sign(message)
			const signedMessage: SignedMessage<Snapshot> = app.messageLog.encode(signature, message)
			await app.messageLog.insert(signedMessage)
		}

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
				const results: { id: string; data: Uint8Array }[] = await messageLog.db.query<{ id: string; data: Uint8Array }>(
					"$messages",
					{
						limit,
						select: { id: true, data: true },
						where: { id: { gt: start } },
						orderBy: { id: "asc" },
					},
				)

				resultCount = results.length

				app.log("got page of %d messages", resultCount)

				const effects: Effect[] = []
				for (const { id, data } of results) {
					const { message } = messageLog.decode(data)
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

		app.messageLog.addEventListener("sync:status", ({ detail: { role, status } }) => {
			if (role === "server") {
				return // Only implemented on the client to avoid races between different sync peers.
			} else if (status === "incomplete") {
				app.syncStatus = "inProgress"
			} else if (status === "complete") {
				app.syncStatus = "complete"
			}
		})

		app.messageLog.addEventListener("connect", ({ detail: { peer } }) => {
			if (app.syncStatus === "offline") {
				app.syncStatus = "starting"
			}
		})

		app.messageLog.addEventListener("disconnect", ({ detail: { peer } }) => {
			app.syncStatus = "offline"
		})

		app.messageLog.addEventListener("error", () => {
			app.syncStatus = "error"
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
	public readonly actions = {} as GetActionsType<ModelsT, InstanceT>
	public signerKeys: string[]

	public readonly as: (signer: SessionSigner<any>) => GetActionsType<ModelsT, InstanceT>

	public readonly create: <M extends string>(
		model: M,
		modelValue: Partial<DeriveModelTypes<ModelsT>[M]>, // TODO: optional primary key only
	) => Promise<SignedMessage<Action, unknown> & { result: unknown }>
	public readonly update: <M extends string>(
		model: M,
		modelValue: Partial<DeriveModelTypes<ModelsT>[M]>,
	) => Promise<SignedMessage<Action, unknown> & { result: unknown }>
	public readonly delete: (
		model: string,
		primaryKey: string,
	) => Promise<SignedMessage<Action, unknown> & { result: unknown }>

	protected readonly controller = new AbortController()
	protected readonly log = logger("canvas:core")
	private lastMessage: number | null = null
	public syncStatus: ClientSyncStatus = "offline"

	private libp2p: Libp2p | null = null
	private networkConfig: NetworkConfig | null = null
	private wsListen: { port: number } | null = null
	private wsConnect: { url: string } | null = null

	protected constructor(
		public readonly signers: SignerCache,
		public readonly messageLog: AbstractGossipLog<MessageType>,
		private readonly runtime: Runtime,
	) {
		super()
		this.db = messageLog.db
		this.signerKeys = this.signers.getAll().map((s) => s.key)

		this.messageLog.addEventListener("message", (event) => this.safeDispatchEvent("message", event))
		this.messageLog.addEventListener("commit", (event) => this.safeDispatchEvent("commit", event))
		this.messageLog.addEventListener("sync", (event) => this.safeDispatchEvent("sync", event))
		this.messageLog.addEventListener("connect", (event) => this.safeDispatchEvent("connect", event))
		this.messageLog.addEventListener("disconnect", (event) => this.safeDispatchEvent("disconnect", event))

		this.messageLog.addEventListener("message", (event) => (this.lastMessage = Date.now()))

		const actionCache = {} as GetActionsType<ModelsT, InstanceT>

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

		this.as = (signer: SessionSigner<any>) =>
			mapValues(actionCache, (action) => action.bind(this, signer)) as GetActionsType<ModelsT, InstanceT>

		this.create = <T extends string>(model: string, modelValue: Partial<DeriveModelTypes<ModelsT>[T]>) => {
			const { [`${model}/create`]: action } = this.actions as Record<string, ActionAPI>
			return action.call(this, modelValue)
		}

		this.update = <T extends string>(model: T, modelValue: Partial<DeriveModelTypes<ModelsT>[T]>) => {
			const { [`${model}/update`]: action } = this.actions as Record<string, ActionAPI>
			return action.call(this, modelValue)
		}

		this.delete = (modelName: string, primaryKey: string) => {
			const { [`${modelName}/delete`]: action } = this.actions as Record<string, ActionAPI>
			return action.call(this, primaryKey)
		}
	}

	public get namespace() {
		return this.runtime.namespace
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
		return this.runtime.getContract()
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
	 * Get existing sessions in the signer cache or localStorage
	 */
	public hasSession(did?: `did:${string}`): boolean {
		for (const signer of this.signers.getAll()) {
			if (signer.listAllSessions(this.topic, did).length > 0) {
				return true
			}
		}
		return false
	}

	/**
	 * Get existing sessions on the log
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
		this.signerKeys = this.signers.getAll().map((s) => s.key)
	}

	public getSigners() {
		return this.signers.getAll()
	}

	public get topic(): string {
		return this.messageLog.topic
	}

	public async stop() {
		this.controller.abort()
		await this.messageLog.close()
		await this.libp2p?.stop()

		// Close the runtime. If we didn't manage ContractRuntime's
		// QuickJS lifetimes correctly, this could throw an exception.
		try {
			this.runtime.close()
		} catch (err) {
			console.error(err)
		}

		this.log("stopped")
		this.dispatchEvent(new Event("stop"))
	}

	public get closed() {
		return this.controller.signal.aborted
	}

	public async getApplicationData(): Promise<ApplicationData> {
		if (this.controller.signal.aborted) {
			throw new Error("application closed")
		}
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
			signerKeys: this.signers.getAll().map((s) => s.key),
			lastMessage: this.lastMessage,
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

	public async createSnapshot(changes?: CreateSnapshotArgs): Promise<Snapshot> {
		return createSnapshot(this, changes)
	}
}
