/// <reference types="../types/random-access-file" />
/// <reference types="../types/ipfs-only-hash" />

import path from "path"

import { getQuickJS, QuickJSWASMModule } from "quickjs-emscripten"

import randomAccessFile from "random-access-file"
import Database, * as sqlite from "better-sqlite3"
import Hash from "ipfs-only-hash"

import type { IPFS } from "ipfs-core-types"
import type { Message } from "@libp2p/interfaces/pubsub"

import * as t from "io-ts"

import type { Action, ModelValue, Session } from "@canvas-js/interfaces"
import { actionType, sessionType } from "./codecs.js"

import { Core } from "./core.js"
import { ObjectSpec, objectSpecType, stringSpecType } from "./specs.js"
import { assert, objectSpecToString } from "./utils.js"

const messageType = t.union([
	t.intersection([t.type({ type: t.literal("action") }), actionType]),
	t.intersection([t.type({ type: t.literal("session") }), sessionType]),
])

export interface NativeCoreConfig {
	spec: string | ObjectSpec
	dataDirectory: string
	replay?: boolean
	ipfs?: IPFS
	peering?: boolean
}

export class NativeCore extends Core {
	public readonly database: sqlite.Database
	private readonly modelStatements: Record<string, { set: sqlite.Statement }> = {}
	private readonly routeStatements: Record<string, sqlite.Statement> = {}
	private readonly peering: boolean
	private readonly ipfs?: IPFS
	private peerId?: string

	static async initialize({ spec, replay, ipfs, ...config }: NativeCoreConfig) {
		assert(objectSpecType.is(spec) || stringSpecType.is(spec), "invalid spec")

		const quickJS = await getQuickJS()
		const contract = typeof spec === "string" ? spec : objectSpecToString(spec)
		const multihash =
			ipfs === undefined ? await Hash.of(contract) : await ipfs.add(contract).then(({ cid }) => cid.toV0().toString())

		const core = new NativeCore({
			multihash,
			spec: contract,
			dataDirectory: config.dataDirectory,
			quickJS,
			ipfs,
			peering: config.peering,
		})

		await core.hyperbee.ready()

		if (replay) {
			await core.replay()
		}

		if (ipfs !== undefined && config.peering) {
			console.log("subscribing to pubsub", core.topic)
			const { id } = await ipfs.id()
			core.peerId = id.toString()
			await ipfs.pubsub.subscribe(core.topic, core.handleMessage)
		}

		return core
	}

	constructor(config: {
		multihash: string
		spec: string
		dataDirectory: string
		quickJS: QuickJSWASMModule
		ipfs?: IPFS
		peering?: boolean
	}) {
		const storage = (file: string) => randomAccessFile(path.resolve(config.dataDirectory, "hypercore", file))
		super({ ...config, storage })

		this.database = new Database(path.resolve(config.dataDirectory, "db.sqlite"))

		// this has to be called *before* we try to prepare any statements
		this.database.exec(Core.getDatabaseSchema(this.models))

		// Prepare model statements
		for (const [name, model] of Object.entries(this.models)) {
			// TODO: validate model name
			const keys = ["timestamp", ...Object.keys(model)]
			const fields = keys.join(", ")
			const params = keys.map((key) => `:${key}`).join(", ")
			const condition = (n: string) => `${n} = CASE WHEN timestamp < :timestamp THEN :${n} ELSE ${n} END`
			const updates = keys.map(condition).join(", ")

			this.modelStatements[name] = {
				set: this.database.prepare(
					`INSERT INTO ${name} (id, ${fields}) VALUES (:id, ${params}) ON CONFLICT (id) DO UPDATE SET ${updates}`
				),
			}

			// Prepare route statements
			for (const [route, query] of Object.entries(this.routes)) {
				this.routeStatements[route] = this.database.prepare(query)
			}
		}

		this.peering = config.peering === true
		this.ipfs = config.ipfs
	}

	private handleMessage = (event: Message) => {
		if (event.from.toString() === this.peerId) {
			return
		}

		console.log("handling pubsub message!")
		let message: any
		try {
			const data = new TextDecoder().decode(event.data)
			message = JSON.parse(data)
		} catch (e) {
			console.error("failed to parse pubsub message")
			console.error(e)
			return
		}

		if (messageType.is(message)) {
			if (message.type === "action") {
				console.log("got action over pubsub", message.payload)
				super.apply(message)
			} else if (message.type === "session") {
				console.log("got session over pubsub", message.payload)
				super.session(message)
			}
		}
	}

	public get topic() {
		return `canvas:${this.multihash}`
	}

	public setModel(name: string, params: Record<string, ModelValue>) {
		assert(name in this.models, "invalid model name")
		const typedParams: Record<string, Exclude<ModelValue, boolean>> = {}
		for (const [key, value] of Object.entries(params)) {
			typedParams[key] = typeof value === "boolean" ? Number(value) : value
		}
		this.modelStatements[name].set.run(typedParams)
	}

	public async getRoute(route: string, params: Record<string, ModelValue> = {}): Promise<Record<string, ModelValue>[]> {
		assert(route in this.routes, "invalid route")
		const statement = this.routeStatements[route]
		const typedParams: Record<string, Exclude<ModelValue, boolean>> = {}
		for (const [key, value] of Object.entries(params)) {
			typedParams[key] = typeof value === "boolean" ? Number(value) : value
		}

		return statement.all(typedParams)
	}

	public async close() {
		if (this.ipfs !== undefined && this.peering) {
			console.log("unsubscribing from pubsub", this.topic)
			this.ipfs.pubsub.unsubscribe(this.topic, this.handleMessage)
		}

		await super.close()
		this.database.close()
	}

	public async apply(action: Action, options: { replaying?: boolean } = {}) {
		const result = await super.apply(action, options)
		if (this.ipfs !== undefined && this.peering) {
			console.log("publishing action to pubsub")
			const message = JSON.stringify({ type: "action", ...action })
			const data = new TextEncoder().encode(message)
			await this.ipfs.pubsub.publish(this.topic, data).catch((err) => {
				console.error("failed to publish action to pubsub")
				console.error(err)
			})
		} else {
		}
		return result
	}

	public async session(session: Session) {
		await super.session(session)
		if (this.ipfs !== undefined && this.peering) {
			console.log("publishing session to pubsub")
			const message = JSON.stringify({ type: "session", ...session })
			const data = new TextEncoder().encode(message)
			await this.ipfs.pubsub.publish(this.topic, data).catch((err) => {
				console.error("failed to publish session to pubsub")
				console.error(err)
			})
		}
	}
}
