import { Awaitable } from "@canvas-js/interfaces"

export class ReplicatedConfig {
	topic?: string
}

export class ReplicatedObjectError extends Error {}

export type Call = (...args: any[]) => Awaitable<void>

export type CallAPI = Record<string, Call>