import type { Signature } from "@canvas-js/signed-cid"

import type { Message } from "./message.js"
import type { Session } from "./session.js"
import type { Action } from "./action.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface SessionSigner {
	match: (chain: string) => boolean

	sign: (message: Message<Action | Session>) => Awaitable<Signature>

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

export interface SessionStore {
	get: (key: string) => Awaitable<string | null>
	set: (key: string, value: string) => Awaitable<void>
	delete: (key: string) => Awaitable<void>
}
