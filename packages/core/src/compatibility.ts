import { mapValues } from "@canvas-js/utils"
import { ModelAPI, ActionContext } from "./types.js"

export type TransformActionParams<T> = {
	[K in keyof T]: T[K] extends (db: ModelAPI<any>, ...args: infer Args) => any
		? (...args: Args) => ReturnType<T[K]>
		: never
}

type ArrowFnActionMap = Record<string, (db: ModelAPI<any>, ...args: any[]) => any>

/**
 * Transforms a collection of arrow-function actions of the format
 *
 * `(db: ModelAPI, ...args) => Promise<Result>`
 *
 * into actions compatible with the updated API:
 *
 * `(this: ActionContext, ...args) => Promise<Result>`
 *
 */
export const transformArrowFns = (actionsMap: ArrowFnActionMap) => {
	return mapValues(actionsMap, (action: (db: ModelAPI<any>, ...args: any[]) => any) => {
		return async function (this: ActionContext<any>, ...args: any[]) {
			return action(this.db, ...args)
		} as any
	}) as TransformActionParams<typeof actionsMap>
}

/**
 * Transforms a collection of arrow-function actions of the format
 *
 * `(db: ModelAPI, ...args) => Promise<Result>`
 *
 * into actions compatible with the updated API:
 *
 * `(this: ActionContext, ...args) => Promise<Result>`
 *
 * while wrapping all actions in a transaction.
 *
 */
export const transformArrowFnsTransactional = (actionsMap: ArrowFnActionMap) => {
	return mapValues(actionsMap, (action: (db: ModelAPI<any>, ...args: any[]) => any) => {
		return async function (this: ActionContext<any>, ...args: any[]) {
			return await this.db.transaction(() => {
				return action(this.db, ...args)
			})
		} as any
	}) as TransformActionParams<typeof actionsMap>
}
