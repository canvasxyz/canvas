import type { DeriveModelTypes, ModelSchema, ModelValue } from "@canvas-js/modeldb"
import type { Awaitable } from "@canvas-js/interfaces"

export type { ModelValue, ModelSchema, DeriveModelTypes, DeriveModelType } from "@canvas-js/modeldb"

export type Contract<
	ModelsT extends ModelSchema = ModelSchema,
	ActionsT extends Actions<ModelsT> = Actions<ModelsT>,
> = {
	models: ModelsT
	actions: ActionsT
}

export type Actions<ModelsT extends ModelSchema> = Record<string, ActionImplementation<ModelsT>>

export type ActionImplementation<
	ModelsT extends ModelSchema = ModelSchema,
	Args extends Array<any> = any,
	Result = any,
> = (
	this: ActionContext<DeriveModelTypes<ModelsT>>,
	db: ModelAPI<DeriveModelTypes<ModelsT>>,
	...args: Args
) => Awaitable<Result>

export type Chainable<ModelTypes extends Record<string, ModelValue>> = Promise<void> & {
	link: <T extends keyof ModelTypes & string>(
		model: T,
		primaryKey: string,
		through?: { through: string },
	) => Promise<void>
	unlink: <T extends keyof ModelTypes & string>(
		model: T,
		primaryKey: string,
		through?: { through: string },
	) => Promise<void>
}

export type ModelAPI<ModelTypes extends Record<string, ModelValue>> = {
	get: <T extends keyof ModelTypes & string>(model: T, key: string) => Promise<ModelTypes[T] | null>
	select: <T extends keyof ModelTypes & string>(model: T, key: string) => Chainable<ModelTypes>
	set: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Chainable<ModelTypes>
	create: <T extends keyof ModelTypes & string>(model: T, value: ModelTypes[T]) => Chainable<ModelTypes>
	update: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Chainable<ModelTypes>
	merge: <T extends keyof ModelTypes & string>(model: T, value: Partial<ModelTypes[T]>) => Chainable<ModelTypes>
	delete: <T extends keyof ModelTypes & string>(model: T, key: string) => Promise<void>
	yjsInsert: <T extends keyof ModelTypes & string>(
		model: T,
		key: string,
		index: number,
		content: string,
	) => Promise<void>
	yjsDelete: <T extends keyof ModelTypes & string>(
		model: T,
		key: string,
		index: number,
		length: number,
	) => Promise<void>
}

export type ActionContext<T extends Record<string, ModelValue>> = {
	db: ModelAPI<T>
	id: string
	did: string
	address: string
	blockhash: string | null
	timestamp: number
	publicKey: string
}
