import type { Signed } from "@canvas-js/signed-value"

import type { Action, ActionArguments, ActionContext } from "./action.js"

export type Env = Record<string, string>

type Awaitable<T> = T | Promise<T>

export interface Signer {
	match: (chain: string) => boolean
	create: (name: string, args: ActionArguments, context: ActionContext, env: Env) => Awaitable<Signed<Action>>
	verify: (message: Signed<Action>) => Awaitable<void>
}

export interface SessionStore {
	save: (address: string, chain: string, privateSessionData: string) => Awaitable<void>
	load: (address: string, chain: string) => Awaitable<string | null>
}
