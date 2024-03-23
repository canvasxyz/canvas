import type { Signer } from "./Signer.js"
import type { Session } from "./Session.js"
import type { Action } from "./Action.js"
import type { Awaitable } from "./Awaitable.js"

export interface SessionSigner<AuthorizationData = any>
	extends Pick<Signer<Action | Session<AuthorizationData>>, "codecs" | "sign" | "verify"> {
	match: (address: string) => boolean

	/**
	 * `getSession` is called by the Canvas runtime for every new action appended
	 * to the log (ie for new actions taken by local users, not existing messages
	 * received from other peers via merkle sync or GossipSub).
	 *
	 * It's responsible for returning a `Session` that matches the given parameters,
	 * either by looking up a cached session, or by getting user authorization to create
	 * a new one (and then caching it).
	 *
	 * "Matching the given parameters" means that the caller passes a `topic: string`
	 * and an optional `timestamp?: number`, and `getSession` must return a `Session`
	 * authorized for that topic, and that is valid for the given timestamp.
	 */
	getSession: (
		topic: string,
		options?: { timestamp?: number; fromCache?: boolean },
	) => Awaitable<Session<AuthorizationData>>

	/**
	 * `getCachedSession` returns the stored `Session` and `Signer` for a given topic and
	 * address. This can be used by applications to check if a user has already authorised
	 * Canvas to sign actions.
	 *
	 * Note that `getCachedSession` does not check if the `Session` has expired.
	 */
	getCachedSession(
		topic: string,
		address: string,
	): { session: Session; signer: Signer<Action | Session<AuthorizationData>> } | null

	/**
	 * Verify that `session.data` authorizes `session.publicKey`
	 * to take actions on behalf of the user `${session.chain}:${session.address}`
	 */
	verifySession: (topic: string, session: Session<AuthorizationData>) => Awaitable<void>

	clear(topic: string): Awaitable<void>

	/**
	 * A unique identifier based on the signer's arguments, used to trigger React effects.
	 * This should not change unless user-provided arguments to the signers change.
	 *
	 * For example, the key for `new SIWESigner()` should always remain the same, even if
	 * a different burner wallet is generated on every call.
	 */
	key: string
}
