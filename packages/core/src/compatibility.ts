import { mapValues } from "@canvas-js/utils"
import type { ModelAPI, ModelSchema, ActionContext, ContractClass } from "./types.js"
import { Contract } from "./contract.js"

export type TransformActionParams<T, M extends ModelSchema> = {
	[K in keyof T]: T[K] extends (db: ModelAPI<any>, ...args: infer Args) => any
		? (...args: Args) => ReturnType<T[K]>
		: never
} & Contract<M>

export function transactionalize<T extends Record<string, (db: ModelAPI<any>, ...args: any[]) => any>>(
	actionsMap: T,
): TransformActionParams<T, any> {
	return mapValues(actionsMap, (action: (db: ModelAPI<any>, ...args: any[]) => any) => {
		return async function (this: ActionContext<any>, ...args: any[]) {
			return await this.db.transaction(() => {
				return action.apply(this, [this.db, ...args])
			})
		} as any
	}) as TransformActionParams<T, any>
}

export function createClassContract<
	M extends ModelSchema,
	A extends Record<string, (db: ModelAPI<any>, ...args: any[]) => any>,
>(
	className: string,
	topic: string,
	models: M,
	actions: A,
): ContractClass<typeof models, TransformActionParams<typeof actions, typeof models>> & Contract<typeof models> {
	const transactionalizedActions = transactionalize(actions)

	const DynamicClass = class DynamicClass extends Contract {
		static get topic() {
			return topic
		}
		static get models() {
			return models ?? (this as any)._models
		}
		constructor() {
			super()
			for (const [key, value] of Object.entries(transactionalizedActions)) {
				Object.defineProperty(this, key, {
					value: value,
					writable: true,
					enumerable: true,
					configurable: true,
				})
			}
		}
	}

	Object.defineProperty(DynamicClass, "name", {
		value: className,
		writable: false,
	})

	for (const [key, value] of Object.entries(transactionalizedActions)) {
		Object.defineProperty(DynamicClass.prototype, key, {
			value: value,
			writable: true,
			enumerable: true,
			configurable: true,
		})
	}

	return DynamicClass as unknown as ContractClass<typeof models, TransformActionParams<typeof actions, typeof models>> &
		Contract<typeof models>
}
