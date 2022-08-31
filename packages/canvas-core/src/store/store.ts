import type { Action, ActionContext, Session, Model, ModelValue } from "@canvas-js/interfaces"

export type Effect =
	| { type: "set"; model: string; id: string; values: Record<string, ModelValue> }
	| { type: "del"; model: string; id: string }

export interface StoreConfig {
	databaseURI: string | null
	models: Record<string, Model>
	routes: Record<string, string>
	replay: boolean
	reset: boolean
	verbose?: boolean
}

export interface Store {
	insertAction(params: { hash: string; data: Uint8Array }): Promise<void>
	insertSession(params: { hash: string; data: Uint8Array; address: string }): Promise<void>
	getActionByHash(hash: string): Promise<Action | null>
	getSessionByHash(hash: string): Promise<Session | null>
	getSessionByAddress(address: string): Promise<Session | null>
	getActionStream(): AsyncIterable<[string, Action]>
	getSessionStream(): AsyncIterable<[string, Session]>

	ready(): Promise<void>
	close(): void

	applyEffects(context: ActionContext, effects: Effect[]): Promise<void>
	getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]>
}
