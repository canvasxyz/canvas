import { Awaitable, SessionSigner } from "@canvas-js/interfaces"

export class ReplicatedConfig {
	topic?: string
}

export class ReplicatedObjectError extends Error {}

export type Call = (...args: any[]) => Awaitable<any>

export type CallAPI = Record<string, Call>
