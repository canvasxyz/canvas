import { JSValue } from "@canvas-js/utils"
import type { ActionContext, DeriveModelTypes, ModelAPI, ModelSchema } from "./types.js"
import { Canvas, Config } from "@canvas-js/core"

export class Contract<ModelsT extends ModelSchema = ModelSchema> implements ActionContext<DeriveModelTypes<ModelsT>> {
	public static get topic(): string {
		throw new Error("the `Contract` class must be extended by a child class providing `static topic`")
	}

	public static get models(): ModelSchema {
		throw new Error("the `Contract` class must be extended by a child class providing `static models`")
	}

	public static async initialize<M extends ModelSchema, T extends typeof Contract<M> | (new () => Contract<any>)>(
		this: T,
		config?: Exclude<Config, "contract">,
	) {
		const instance = await Canvas.initialize({
			...config,
			contract: this as typeof Contract<M>,
		})

		return instance as Canvas<M, InstanceType<T>>
	}

	constructor(...args: JSValue[]) {}

	public get db(): ModelAPI<DeriveModelTypes<ModelsT>> {
		throw new Error("cannot access this.db outside an action handler")
	}

	public get id(): string {
		throw new Error("cannot access this.id outside an action handler")
	}

	public get did(): `did:${string}` {
		throw new Error("cannot access this.did outside an action handler")
	}

	public get address(): string {
		throw new Error("cannot access this.address outside an action handler")
	}

	public get blockhash(): string | null {
		throw new Error("cannot access this.blockhash outside an action handler")
	}

	public get timestamp(): number {
		throw new Error("cannot access this.timestamp outside an action handler")
	}

	public get publicKey(): string {
		throw new Error("cannot access this.publicKey outside an action handler")
	}
}
