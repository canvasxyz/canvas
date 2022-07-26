import type { Action, ActionContext, Session, ModelValue } from "@canvas-js/interfaces"

export type Effect =
	| { type: "set"; model: string; id: string; values: Record<string, ModelValue> }
	| { type: "del"; model: string; id: string }

export abstract class Store {
	public static DATABASE_FILENAME = "db.sqlite"

	abstract insertAction(key: string, action: Action): Promise<void>
	abstract insertSession(key: string, session: Session): Promise<void>
	abstract getAction(key: string): Promise<Action | null>
	abstract getSession(key: string): Promise<Session | null>
	abstract getActionStream(limit: number): AsyncIterable<[string, Action]>
	abstract getSessionStream(limit: number): AsyncIterable<[string, Session]>
	abstract getHistoryStream(limit: number): AsyncIterable<[string, Action | Session]>

	abstract applyEffects(context: ActionContext, effects: Effect[]): void
	abstract close(): void
	abstract getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[]
}
