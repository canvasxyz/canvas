import type { Signature } from "@canvas-js/signed-cid"

import type { Message } from "./message.js"
import type { Session } from "./session.js"
import type { Action } from "./action.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface SessionSigner {
	match: (chain: string) => boolean
	sign: (message: Message<Action | Session>) => Awaitable<Signature>

	/** Verify that `session.data` authorizes `session.publicKey` to take actions on behalf of the user */
	verifySession: (session: Session) => Awaitable<void>

	getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session>
	clear: () => Awaitable<void>
}

export interface SessionStore {
	get: (key: string) => Awaitable<string | null>
	set: (key: string, value: string) => Awaitable<void>
	delete: (key: string) => Awaitable<void>
}
