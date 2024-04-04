import { Logger, logger } from "@libp2p/logger"
import * as json from "@ipld/dag-json"

import type { Signature, SessionSigner, Action, Message, Session, Signer, Awaitable } from "@canvas-js/interfaces"
import { assert, signalInvalidType } from "@canvas-js/utils"

import target from "#target"
import { equals } from "multiformats/bytes"

export interface AbstractSessionData {
	topic: string
	address: string
	publicKey: string
	timestamp: number
	duration: number | null
}

export interface AbstractSessionSignerConfig<AuthorizationData> {
	defaultDuration?: number | null
	createSigner: (init?: { type: string; privateKey: Uint8Array }) => Signer<Action | Session<AuthorizationData>>
}

export abstract class AbstractSessionSigner<AuthorizationData> implements SessionSigner<AuthorizationData> {
	public readonly target = target

	protected readonly log: Logger

	#createSigner: (init?: { type: string; privateKey: Uint8Array }) => Signer<Action | Session<AuthorizationData>>
	#defaultDuration: number | null

	public constructor(public readonly key: string, config: AbstractSessionSignerConfig<AuthorizationData>) {
		this.log = logger(`canvas:${key}`)
		this.#createSigner = config.createSigner
		this.#defaultDuration = config.defaultDuration ?? null
	}

	public abstract codecs: string[]
	public abstract match: (address: string) => boolean
	public abstract verify: (signature: Signature, message: Message<Action | Session<AuthorizationData>>) => void
	public abstract verifySession(topic: string, session: Session<AuthorizationData>): Awaitable<void>

	protected abstract getAddress(): Awaitable<string>
	protected abstract newSession(data: AbstractSessionData): Awaitable<Session<AuthorizationData>>

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

		const signer = await this.#createSigner()
		this.log("created new signer with public key %s", signer.uri)

		this.log("creating new session for %s", address)
		const timestamp = options.timestamp ?? Date.now()
		const session = await this.newSession({
			topic,
			address,
			publicKey: signer.uri,
			timestamp,
			duration: this.#defaultDuration,
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

			assert(equals(json.encode(message.payload), json.encode(session)))
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
		const signer = this.#createSigner({ type, privateKey })
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
