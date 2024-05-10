import * as json from "@ipld/dag-json"
import { Logger, logger } from "@libp2p/logger"

import type {
	Action,
	Session,
	Signer,
	Awaitable,
	SignatureScheme,
	AbstractSessionData,
	SessionSigner,
} from "@canvas-js/interfaces"

import target from "#target"

export interface AbstractSessionSignerOptions {
	sessionDuration?: number | null
}

export abstract class AbstractSessionSigner<AuthorizationData> implements SessionSigner<AuthorizationData> {
	public readonly target = target
	public readonly sessionDuration: number | null

	protected readonly log: Logger

	#cache = new Map<string, { session: Session; signer: Signer<Action | Session<AuthorizationData>> }>()

	public constructor(
		public readonly key: string,
		public readonly scheme: SignatureScheme<Action | Session<AuthorizationData>>,
		options: AbstractSessionSignerOptions = {},
	) {
		this.log = logger(`canvas:${key}`)
		this.sessionDuration = options.sessionDuration ?? null
	}

	public abstract match: (address: string) => boolean
	public abstract verifySession(topic: string, session: Session<AuthorizationData>): Awaitable<void>

	public abstract getAddress(): Awaitable<string>

	public abstract authorize(data: AbstractSessionData): Awaitable<Session<AuthorizationData>>

	public async newSession(
		topic: string,
	): Promise<{ payload: Session<AuthorizationData>; signer: Signer<Action | Session<AuthorizationData>> }> {
		const signer = this.scheme.create()
		const address = await this.getAddress()
		const session = await this.authorize({
			topic,
			address,
			publicKey: signer.publicKey,
			timestamp: Date.now(),
			duration: this.sessionDuration,
		})

		const key = `canvas/${topic}/${address}`
		this.#cache.set(key, { session, signer })
		target.set(key, json.stringify({ session, ...signer.export() }))

		return { payload: session, signer }
	}

	public async getSession(
		topic: string,
	): Promise<{ payload: Session<AuthorizationData>; signer: Signer<Action | Session<AuthorizationData>> } | null> {
		const address = await this.getAddress()
		const key = `canvas/${topic}/${address}`

		if (this.#cache.has(key)) {
			const { session, signer } = this.#cache.get(key)!
			return { payload: session, signer }
		}

		const value = target.get(key)
		if (value !== null) {
			const entry = json.parse<{ type: string; privateKey: Uint8Array; session: Session }>(value)
			const { type, privateKey, session } = entry

			const signer = this.scheme.create({ type, privateKey })
			return { payload: session, signer }
		}

		return null
	}

	public hasSession(topic: string, address: string): boolean {
		const key = `canvas/${topic}/${address}`
		return this.#cache.has(key) || target.get(key) !== null
	}

	public async clear(topic: string) {
		const prefix = `canvas/${topic}/`

		for (const key of this.#cache.keys()) {
			if (key.startsWith(prefix)) {
				this.#cache.delete(key)
			}
		}
	}
}
