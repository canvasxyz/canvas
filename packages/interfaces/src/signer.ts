import type { Signature } from "./signature.js"
import type { Message } from "./message.js"
import type { Session } from "./session.js"
import type { Action } from "./action.js"
import type { Awaitable } from "./utils.js"

export interface MessageSigner<Payload = unknown> {
	sign: (message: Message<Payload>) => Signature
}

export interface SessionSigner extends MessageSigner<Action | Session> {
	match: (chain: string) => boolean

	/**
	 * Produce an signed Session object, which authorizes `session.publicKey`
	 * to represent the user `${session.chain}:${session.address}`.
	 *
	 * The signature is stored in `session.data`, and the entire Session
	 * object is then signed using the session-key, and appended to our message log.
	 */
	getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session>

	/**
	 * Verify that `session.data` authorizes `session.publicKey`
	 * to take actions on behalf of the user `${session.chain}:${session.address}`
	 */
	verifySession: (session: Session) => Awaitable<void>
}
