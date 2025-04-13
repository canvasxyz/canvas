import * as json from "@ipld/dag-json"
import { Logger, logger } from "@libp2p/logger"
import { randomBytes, bytesToHex } from "@noble/hashes/utils"

import type {
	Session,
	Signer,
	Awaitable,
	SignatureScheme,
	AbstractSessionData,
	SessionSigner,
	DidIdentifier,
	MessageType,
} from "@canvas-js/interfaces"

import target from "#target"

export interface AbstractSessionSignerOptions {
	sessionDuration?: number | null
}

export abstract class AbstractSessionSigner<
	AuthorizationData,
	WalletAddress extends string = string,
	AuthorizationContext = never,
> implements SessionSigner<AuthorizationData>
{
	public readonly target = target
	public readonly sessionDuration: number | null

	protected readonly log: Logger

	#cache = new Map<string, { session: Session; signer: Signer<MessageType<AuthorizationData>> }>()

	public constructor(
		public readonly key: string,
		public readonly scheme: SignatureScheme<MessageType<AuthorizationData>>,
		options: AbstractSessionSignerOptions = {},
	) {
		this.log = logger(`canvas:signer:${key}`)
		this.sessionDuration = options.sessionDuration ?? null
	}

	public abstract match: (address: string) => boolean
	public abstract verifySession(topic: string, session: Session<AuthorizationData>): Awaitable<void>

	public abstract isReadOnly(): boolean
	public abstract getDid(): Awaitable<DidIdentifier>
	public abstract getDidParts(): number
	public abstract getAddressFromDid(did: DidIdentifier): WalletAddress
	public async getWalletAddress() {
		return this.getAddressFromDid(await this.getDid())
	}

	/**
	 * Get a new Session<AuthorizationData> by asking the signer's wallet to
	 * produce an authorization signature.
	 */
	public abstract authorize(data: AbstractSessionData): Awaitable<Session<AuthorizationData>>

	public getCurrentTimestamp() {
		return Date.now()
	}

	/**
	 * Start a new session, either by requesting a signature from a wallet right now,
	 * or by using a provided AuthorizationData and timestamp (for services like Farcaster).
	 */
	public async newSession(
		topic: string,
	): Promise<{ payload: Session<AuthorizationData>; signer: Signer<MessageType<AuthorizationData>> }> {
		const signer = this.scheme.create()
		const did = await this.getDid()

		const sessionData = {
			topic,
			did,
			publicKey: signer.publicKey,
			context: {
				timestamp: this.getCurrentTimestamp(),
				duration: this.sessionDuration,
			},
		}
		const session = await this.authorize(sessionData)

		const key = `canvas/${topic}/${did}`
		this.#cache.set(key, { session, signer })
		target.set(key, json.stringify({ session, ...signer.export() }))

		return { payload: session, signer }
	}

	/**
	 * Create and validate a Session<AuthorizationData> from a preexisting, externally
	 * provided AuthorizationData.
	 */
	public async getSessionFromAuthorizationData(
		data: AbstractSessionData,
		authorizationData: AuthorizationData,
	): Promise<Session<AuthorizationData>> {
		const {
			did,
			publicKey,
			topic,
			context: { duration, timestamp },
		} = data

		const session: Session<AuthorizationData> = {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData,
			context: duration ? { duration, timestamp } : { timestamp },
		}

		await this.verifySession(topic, session)

		return session
	}

	/*
	 * Get an existing session for `topic`. You may also provide a specific DID to check
	 * if a session exists for that specific address.
	 */
	public async getSession(
		topic: string,
		options: { did?: string; address?: string } = {},
	): Promise<{
		payload: Session<AuthorizationData>
		signer: Signer<MessageType<AuthorizationData>>
	} | null> {
		let did
		if (options.address) {
			const dids = this.listSessions(topic).filter((did) => did.endsWith(":" + options.address))
			if (dids.length === 0) return null
			did = dids[0]
		} else {
			did = await Promise.resolve(options.did ?? this.getDid())
		}
		const key = `canvas/${topic}/${did}`

		this.log("getting session for topic %s and DID %s", topic, did)

		if (this.#cache.has(key)) {
			const { session, signer } = this.#cache.get(key)!
			this.log("found session and signer in cache")
			return { payload: session, signer }
		}

		const value = target.get(key)
		if (value !== null) {
			this.log("found session and signer in storage")
			const entry = json.parse<{ type: string; privateKey: Uint8Array; session: Session }>(value)
			const { type, privateKey, session } = entry

			const signer = this.scheme.create({ type, privateKey })
			return { payload: session, signer }
		}

		this.log("session and signer not found")
		return null
	}

	public listSessions(topic: string): string[] {
		if (this.isReadOnly()) return []
		// TODO: look at target
		const prefix = `canvas/${topic}/`
		const result = []

		for (const key of this.#cache.keys()) {
			if (key.startsWith(prefix)) {
				result.push(key)
			}
		}
		return result
	}

	// TODO: remove in favor of listSessions?
	public hasSession(topic: string, did?: DidIdentifier): boolean {
		if (this.isReadOnly()) return false
		if (did) {
			const key = `canvas/${topic}/${did}`
			return this.#cache.has(key) || target.get(key) !== null
		} else {
			for (const key of this.#cache.keys()) {
				if (key.startsWith(`canvas/${topic}/`)) return true
			}
			return target.getFirst(`canvas/${topic}/`) !== null
		}
	}

	public async clear(topic: string) {
		// TODO: delete from target
		const prefix = `canvas/${topic}/`

		for (const key of this.#cache.keys()) {
			if (key.startsWith(prefix)) {
				this.#cache.delete(key)
			}
		}
	}
}
