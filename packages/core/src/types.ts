import type { ModelValue } from "@canvas-js/modeldb"
import type { Action, Awaitable } from "@canvas-js/interfaces"

export type { ModelValue } from "@canvas-js/modeldb"
import type {
	ModelInit as DbModelInit,
	ModelSchema as DbModelSchema,
	DeriveModelTypes as DbDeriveModelTypes,
	DeriveModelType as DbDeriveModelType,
} from "@canvas-js/modeldb"

import { Contract } from "@canvas-js/core/contract"
import { SignedMessage } from "@canvas-js/gossiplog"
import { JSValue } from "@canvas-js/utils"

export type RulesInit = { create: string | boolean; update: string | boolean; delete: string | boolean }
export type ModelInit = DbModelInit<{ $rules?: RulesInit }>
export type ModelSchema = DbModelSchema<{ $rules?: RulesInit }>
export type DeriveModelType<T extends ModelSchema> = DbDeriveModelType<T, { $rules?: RulesInit }>
export type DeriveModelTypes<T extends ModelSchema> = DbDeriveModelTypes<T, { $rules?: RulesInit }>

export type ContractClass<
	ModelsT extends ModelSchema = ModelSchema,
	InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>,
> = {
	topic: string
	models: ModelsT
	new (...args: JSValue[]): InstanceT
}

export type ContractAction<ModelsT extends ModelSchema = ModelSchema, Args extends any[] = any[], Result = any> = (
	this: Contract<ModelsT>,
	...args: Args
) => Promise<Result>

export type TypeError<Message extends string> = Message

export type ActionAPI<Args extends any[] = any[], Result = any> = (
	...args: Args
) => Promise<SignedMessage<Action, Result> & { result: Result }>

export type GetActionsType<ModelsT extends ModelSchema, InstanceT extends Contract<ModelsT>> = {
	[K in Exclude<keyof InstanceT, "topic" | keyof Contract<ModelsT>>]: InstanceT[K] extends ContractAction<
		ModelsT,
		infer Args,
		infer Result
	>
		? ActionAPI<Args, Result>
		: InstanceT[K] extends (this: Contract<ModelSchema>, ...args: infer Args) => infer Result
			? ActionAPI<Args, Result> // TypeError<"Contract actions must be marked `async`">
			: never
}

export type ModelAPI<ModelTypes extends Record<string, ModelValue> = Record<string, ModelValue>> = {
	id: () => string
	random: () => number
	get: <T extends keyof ModelTypes & string>(model: T, key: string) => Promise<ModelTypes[T] | null>
	set: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Promise<void>
	delete: <T extends keyof ModelTypes & string>(model: T, key: string) => Promise<void>

	create: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Promise<void>
	update: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Promise<void>
	merge: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Promise<void>

	link: <T extends keyof ModelTypes & string>(
		modelPath: `${T}.${string}`,
		source: string,
		target: string,
	) => Promise<void>
	unlink: <T extends keyof ModelTypes & string>(
		modelPath: `${T}.${string}`,
		source: string,
		target: string,
	) => Promise<void>

	transaction: <T>(callback: () => Awaitable<T>) => Promise<T>
}

export type ActionContext<ModelTypes extends Record<string, ModelValue> = Record<string, ModelValue>> = {
	db: ModelAPI<ModelTypes>
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}

// export type DeriveActions<T extends ModelSchema> = {
// 	[K in keyof T as T[K] extends { $rules: any } ? `create${Capitalize<string & K>}` : never]: (
// 		this: Contract<T>,
// 		item: Partial<DeriveModelTypes<T>[K]>,
// 	) => Promise<any>
// } & {
// 	[K in keyof T as T[K] extends { $rules: any } ? `update${Capitalize<string & K>}` : never]: (
// 		this: Contract<T>,
// 		item: DeriveModelTypes<T>[K],
// 	) => Promise<any>
// } & {
// 	[K in keyof T as T[K] extends { $rules: any } ? `delete${Capitalize<string & K>}` : never]: (
// 		this: Contract<T>,
// 		id: string,
// 	) => Promise<any>
// }

// export type DeriveContractClass<T extends ModelSchema = ModelSchema> = DeriveActions<T> &
// 	ContractClass<T, Contract<T> & DeriveActions<T>>
