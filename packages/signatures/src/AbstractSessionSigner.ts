import { Logger, logger } from "@libp2p/logger"
import * as json from "@ipld/dag-json"

import type {
	Signature,
	SessionSigner,
	AbstractSessionData,
	Action,
	Message,
	Session,
	Signer,
	Awaitable,
	SignatureScheme,
} from "@canvas-js/interfaces"
import { assert, signalInvalidType } from "@canvas-js/utils"

import target from "#target"
import { deepEquals } from "./utils.js"
import { SignerStore } from "./targets/index.js"

export interface AbstractSessionSignerOptions {
	sessionDuration?: number | null
}

export abstract class AbstractSessionSigner<AuthorizationData> implements SessionSigner<AuthorizationData> {
	public readonly target = target
	public readonly sessionDuration: number | null

	protected readonly log: Logger

	#signerStore: SignerStore<AuthorizationData>

	public constructor(
		public readonly key: string,
		public readonly scheme: SignatureScheme<Action | Session<AuthorizationData>>,
		options: AbstractSessionSignerOptions = {},
	) {
		this.log = logger(`canvas:${key}`)
		this.#signerStore = target.getSignerStore<AuthorizationData>(scheme)
		this.sessionDuration = options.sessionDuration ?? null
	}

	public abstract match: (address: string) => boolean
	public abstract verifySession(topic: string, session: Session<AuthorizationData>): Awaitable<void>

	public abstract getAddress(): Awaitable<string>

	public abstract newSession(data: AbstractSessionData): Awaitable<Session<AuthorizationData>>

	public getDelegateSigner(topic: string, address: string) {
		return this.#signerStore.get(topic, address)
	}

	public newDelegateSigner(topic: string, address: string) {
		const signer = this.scheme.create()
		this.#signerStore.set(topic, address, signer)
		return signer
	}

	public async getSession(
		topic: string,
		options: { timestamp?: number; fromCache?: boolean } = {},
	): Promise<Session<AuthorizationData>> {
		const address = await this.getAddress()

		this.log("getting session for %s", address)

		{
			const { session, signer } = this.getCachedSession(topic, address) ?? {}
			if (session !== undefined && signer !== undefined) {
				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.log("found session for %s in store: %o", address, session)
					return session
				} else {
					this.log("stored session for %s has expired", address)
				}
			}
		}

		if (options.fromCache) return Promise.reject()

		const signer = await this.scheme.create()
		this.log("created new signer with public key %s", signer.publicKey)

		this.log("creating new session for %s", address)
		const timestamp = options.timestamp ?? Date.now()
		const session = await this.newSession({
			topic,
			address,
			publicKey: signer.publicKey,
			timestamp,
			duration: this.sessionDuration,
		})

		this.setCachedSession(topic, address, session, signer)

		this.log("created new session for %s: %o", address, session)
		return session
	}

	public sign(message: Message<Action | Session>, options?: { codec?: string }): Awaitable<Signature> {
		if (message.payload.type === "action") {
			const { address, timestamp } = message.payload
			const { signer, session } = this.getCachedSession(message.topic, address) ?? {}
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message, options)
		} else if (message.payload.type === "session") {
			const { signer, session } = this.getCachedSession(message.topic, message.payload.address) ?? {}
			assert(signer !== undefined && session !== undefined)

			// only sign our own current sessions
			// use a deep comparison
			assert(deepEquals(message.payload, session))
			return signer.sign(message, options)
		} else {
			signalInvalidType(message.payload)
		}
	}

	public async clear(topic: string) {
		this.#sessionCache.clear()
		target.clear(this.getSessionKey(topic, ""))
	}

	#sessionCache = new Map<string, { session: Session; signer: Signer<Action | Session<AuthorizationData>> }>()

	protected getSessionKey = (topic: string, address: string) => `canvas/${topic}/${address}`

	public getCachedSession(
		topic: string,
		address: string,
	): { session: Session; signer: Signer<Action | Session<AuthorizationData>> } | null {
		if (this.#sessionCache.has(address)) {
			return this.#sessionCache.get(address)!
		}

		const value = target.get(this.getSessionKey(topic, address))
		if (value === null) {
			return null
		}

		const { type, privateKey, session } = json.parse<{ session: Session; type: string; privateKey: Uint8Array }>(value)
		const signer = this.scheme.create({ type, privateKey })
		this.#sessionCache.set(address, { session, signer })
		return { session, signer }
	}

	private setCachedSession(
		topic: string,
		address: string,
		session: Session,
		signer: Signer<Action | Session<AuthorizationData>>,
	): void {
		this.#sessionCache.set(address, { session, signer })

		const { type, privateKey } = signer.export()
		const key = this.getSessionKey(topic, address)
		const value = json.stringify({ type, privateKey, session })
		target.set(key, value)
	}
}
