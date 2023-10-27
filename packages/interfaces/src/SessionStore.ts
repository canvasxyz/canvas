import type { Awaitable } from "./utils.js"

export interface SessionStore {
	get: (key: string) => Awaitable<string | null>
	set: (key: string, value: string) => Awaitable<void>
	delete: (key: string) => Awaitable<void>
}
