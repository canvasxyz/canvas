import type { Signature } from "@canvas-js/signed-cid"

import type { Action, SessionPayload } from "./action.js"
import type { Message } from "./message.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface Signer {
	chain: string
	address: string

	match: (chain: string) => boolean

	/** Verify that `session` authorizes `signature.publicKey` to take actions on behalf of the user */
	verifySession: (signature: Signature, chain: string, address: string, session: SessionPayload) => Awaitable<void>

	getSession: () => Awaitable<SessionPayload>

	sign: (message: Message<Action>) => Awaitable<Signature>
}

export interface SessionStore {
	save: (address: string, chain: string, privateSessionData: string) => Awaitable<void>
	load: (address: string, chain: string) => Awaitable<string | null>
}
