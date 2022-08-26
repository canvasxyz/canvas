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
}

export interface Store {
	insertAction(key: string, action: Action): Promise<void>
	insertSession(key: string, session: Session): Promise<void>
	getAction(key: string): Promise<Action | null>
	getSession(key: string): Promise<Session | null>
	getActionStream(limit: number): AsyncIterable<[string, Action]>
	getSessionStream(limit: number): AsyncIterable<[string, Session]>
	getHistoryStream(limit: number): AsyncIterable<[string, Action | Session]>

	ready(): Promise<void>
	close(): void

	applyEffects(context: ActionContext, effects: Effect[]): Promise<void>
	getRoute(route: string, params: Record<string, ModelValue>): Promise<Record<string, ModelValue>[]>
}
