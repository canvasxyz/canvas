import type { Signature } from "@canvas-js/signed-cid"

import type { Action, ActionArguments, ActionContext } from "./action.js"
import { Message } from "./message.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface Signer {
	chain: string
	address: string

	match: (chain: string) => boolean
	verify: (signature: Signature, message: Message<Action>) => void
	create: (name: string, args: ActionArguments, context: ActionContext, env: Env) => Action
	sign: (message: Message<Action>) => Signature
}

export interface SessionStore {
	save: (address: string, chain: string, privateSessionData: string) => Awaitable<void>
	load: (address: string, chain: string) => Awaitable<string | null>
}
