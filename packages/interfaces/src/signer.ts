import type { Signature } from "@canvas-js/signed-cid"

import type { Message } from "./message.js"
import type { Action } from "./action.js"
import type { Session, SessionData } from "./session.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface Signer {
	match: (chain: string) => boolean

	/** Verify that `session.data` authorizes `session.publicKey` to take actions on behalf of the user */
	verifySession: (session: Session) => Awaitable<void>

	getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session>

	sign: (message: Message<Action | Session>) => Awaitable<Signature>
}

// interface Signer2 {
// 	match: (chain: string) => boolean
// 	getSession: () => Awaitable<Session>
// 	sign: (message: Message<Action | Session>) => Awaitable<Signature>
// 	verifySession: (signature: Signature, session: Session) => Awaitable<void>

// 	getSigner: () => Promise<(message: Message<Action | Session>) => Awaitable<Signature>>
// }

export interface SessionStore {
	save: (topic: string, chain: string, address: string, privateSessionData: string) => Awaitable<void>
	load: (topic: string, chain: string, address: string) => Awaitable<string | null>
}
